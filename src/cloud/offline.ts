import type { SqlJsStatic } from "sql.js";
import { Database, type Row, type Value } from "../database/database";
import { migrations, tables, type Table } from "../database/migrations";
import { BackupService, checksum, type Backup } from "../services/backup";
import type { CloudStore, CloudRecord } from "./store";
import type { LocalCache, OfflineEnvelope, RecoveryCopy } from "./local-cache";
export interface SyncStatus {
  pending: boolean;
  syncing: boolean;
  conflict: boolean;
  lastSynced: string | null;
  message: string;
  updates: boolean;
}
export interface OfflineDatabase {
  db: Database;
  sync(): Promise<void>;
  reload(): Promise<void>;
  dispose(): void;
  status(): SyncStatus;
  subscribe(fn: () => void): () => void;
  resolve(choice: "phone" | "cloud"): Promise<void>;
  copies(): { phone: Backup; cloud: Backup | null; recovery: RecoveryCopy[] };
}
export async function openOfflineDatabase(
  SQL: SqlJsStatic,
  store: CloudStore,
  cache: LocalCache,
  signal?: AbortSignal,
): Promise<OfflineDatabase> {
  if (signal?.aborted) throw new Error("Opening cancelled");
  let engine = new SQL.Database(),
    enabled = false,
    active = true,
    stable: Uint8Array;
  let local = await cache.read(),
    syncing = false,
    updates = false,
    message = "Saved on phone",
    fatal = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  function query(sql: string, values: Value[] = []): Row[] {
    const s = engine.prepare(sql);
    try {
      s.bind(values);
      const rows: Row[] = [];
      while (s.step()) rows.push(s.getAsObject() as Row);
      return rows;
    } finally {
      s.free();
    }
  }
  function capture() {
    const bytes = engine.export();
    engine.run("PRAGMA foreign_keys=ON");
    return bytes;
  }
  function restore(bytes: Uint8Array) {
    engine.close();
    engine = new SQL.Database(bytes);
    engine.run("PRAGMA foreign_keys=ON");
  }
  async function document(): Promise<Backup> {
    const data = Object.fromEntries(
      tables.map((t) => [t, query(`SELECT * FROM ${t} ORDER BY id`)]),
    ) as Record<Table, Row[]>;
    return {
      format: "FarmTrack",
      version: 1,
      schemaVersion: migrations.at(-1)!.version,
      exportedAt: new Date().toISOString(),
      data,
      checksum: await checksum(data),
    };
  }
  async function saveEnvelope(next: OfflineEnvelope) {
    const serial = local?.serial ?? 0;
    next = { ...next, serial: serial + 1 };
    await cache.save(next, serial);
    local = next;
    emit();
  }
  const db = new Database({
    query: async (sql, values) => query(sql, values),
    execute: async (sql, values) => {
      if (enabled && sql === "BEGIN TRANSACTION" && (!active || fatal))
        throw new Error("Reopen EggPro before saving.");
      engine.run(sql, values);
    },
    persist: async () => {
      if (!enabled) return;
      try {
        if (!active || !local) throw new Error("This farm session is closed.");
        await saveEnvelope({
          ...local,
          document: await document(),
          pending: true,
          mutationId: crypto.randomUUID(),
        });
        stable = capture();
        message = "Saved on phone · waiting to sync";
        emit();
      } catch (error) {
        restore(stable);
        fatal = true;
        throw error;
      }
    },
  });
  await db.migrate();
  stable = capture();
  async function install(data: Backup) {
    enabled = false;
    try {
      await new BackupService(new Database(db.driver)).import(
        JSON.stringify(data),
      );
    } finally {
      enabled = true;
    }
  }
  if (local) {
    if (local.version !== 1)
      throw new Error(
        "Unsupported local data version. Update EggPro before opening this farm.",
      );
    if (local.document.data.farms.length) await install(local.document);
    else if (Object.values(local.document.data).some((rows) => rows.length))
      throw new Error(
        "Incomplete local farm. Restore a backup before continuing.",
      );
    stable = capture();
    message = local.pending
      ? "Saved on phone · waiting to sync"
      : "Saved on phone";
  } else {
    // A new device must read cloud state before allowing setup. No empty-farm fallback
    // on network errors: that could replace an existing farm on reconnect.
    const remote = await store.read();
    if (remote) await install(remote.document);
    const initial: OfflineEnvelope = {
      version: 1,
      serial: 0,
      document: remote?.document ?? (await document()),
      baseRevision: remote?.revision ?? 0,
      pending: false,
      mutationId: crypto.randomUUID(),
      lastSynced: remote?.updated_at ?? null,
      recovery: [],
    };
    if (signal?.aborted) throw new Error("Opening cancelled");
    await saveEnvelope(initial);
    stable = capture();
  }
  enabled = true;
  async function sync() {
    if (!active || syncing || fatal) return;
    syncing = true;
    emit();
    try {
      const remote = await store.read();
      let upload: OfflineEnvelope | undefined;
      await db.exclusive(async () => {
        if (!active || !local) return;
        const disk = await cache.read();
        if (disk?.serial !== local.serial) {
          fatal = true;
          throw new Error(
            "Another app window saved this farm. Reopen EggPro to load it.",
          );
        }
        if (!active) return;
        if (local.pending) {
          if (remote?.mutation_id === local.mutationId) {
            await saveEnvelope({
              ...local,
              pending: false,
              baseRevision: remote.revision,
              lastSynced: remote.updated_at,
              conflict: undefined,
            });
            message = "Synced";
            return;
          }
          if ((remote?.revision ?? 0) !== local.baseRevision) {
            await saveEnvelope({ ...local, conflict: { remote } });
            message = "Two versions need review. Both copies are safe.";
            return;
          }
          if (local.conflict) {
            message = "Review the two versions before syncing.";
            return;
          }
          upload = local;
        } else {
          // Do not reload an open form behind the user's back. The UI offers a safe reload.
          updates = (remote?.revision ?? 0) !== local.baseRevision;
          message = updates
            ? "New cloud records available · reload to open them"
            : "Synced";
        }
      });
      if (upload) {
        const sent: OfflineEnvelope = upload;
        const saved = await store.write(
          sent.document,
          sent.baseRevision,
          sent.mutationId,
        );
        await db.exclusive(async () => {
          if (!active || !local) return;
          // Edits made during an upload remain pending and build on its revision.
          await saveEnvelope({
            ...local,
            baseRevision: saved.revision,
            pending: local.mutationId !== sent.mutationId,
            lastSynced: saved.updated_at,
          });
          message = local.pending
            ? "Saved on phone · waiting to sync"
            : "Synced";
        });
      }
    } catch (error) {
      message =
        error instanceof Error
          ? error.message
          : "Sync unavailable. Your records are saved on this phone.";
    } finally {
      syncing = false;
      emit();
    }
  }
  async function reload() {
    await sync();
    const remote = await store.read();
    await db.exclusive(async () => {
      if (!local || !active) return;
      if (local.pending)
        throw new Error(
          "Your phone has unsynced records. Sync or review the two versions first.",
        );
      if (!remote)
        throw new Error(
          "No cloud copy is available. Your local farm was kept.",
        );
      const before = stable;
      try {
        await install(remote.document);
        await saveEnvelope({
          ...local,
          document: remote.document,
          baseRevision: remote.revision,
          lastSynced: remote.updated_at,
          conflict: undefined,
        });
        stable = capture();
        updates = false;
        message = "Latest cloud records loaded";
      } catch (error) {
        restore(before);
        throw error;
      }
      emit();
    });
  }
  async function resolve(choice: "phone" | "cloud") {
    if (syncing)
      throw new Error(
        "Wait for the current sync to finish, then review the versions.",
      );
    const remote = await store.read();
    await db.exclusive(async () => {
      if (!local?.conflict) throw new Error("There is no conflict to review.");
      if (!remote)
        throw new Error(
          "Cloud copy is unavailable. Both versions have been kept.",
        );
      if (remote.revision !== local.conflict.remote?.revision) {
        await saveEnvelope({ ...local, conflict: { remote } });
        throw new Error(
          "The cloud copy changed again. Review its latest version first.",
        );
      }
      const recovery = [
        ...local.recovery,
        {
          date: new Date().toISOString(),
          label: "Phone before conflict resolution",
          document: local.document,
        },
        {
          date: new Date().toISOString(),
          label: "Cloud before conflict resolution",
          document: remote.document,
        },
      ];
      if (choice === "phone")
        await saveEnvelope({
          ...local,
          baseRevision: remote.revision,
          conflict: undefined,
          recovery,
          mutationId: crypto.randomUUID(),
        });
      else {
        const before = stable;
        try {
          await install(remote.document);
          await saveEnvelope({
            ...local,
            document: remote.document,
            baseRevision: remote.revision,
            pending: false,
            lastSynced: remote.updated_at,
            conflict: undefined,
            recovery,
          });
          stable = capture();
        } catch (error) {
          restore(before);
          throw error;
        }
      }
      message = "Both recovery copies saved on this phone";
      emit();
    });
    if (choice === "phone") await sync();
  }
  return {
    db,
    sync,
    reload,
    resolve,
    status: () => ({
      pending: local?.pending ?? false,
      syncing,
      conflict: Boolean(local?.conflict),
      lastSynced: local?.lastSynced ?? null,
      message,
      updates,
    }),
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    copies: () => ({
      phone: local!.document,
      cloud: local?.conflict?.remote?.document ?? null,
      recovery: local?.recovery ?? [],
    }),
    dispose() {
      active = false;
      listeners.clear();
    },
  };
}
