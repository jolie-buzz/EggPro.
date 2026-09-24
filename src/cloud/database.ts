import type { SqlJsStatic, Database as SQLite } from "sql.js";
import { Database, type Row, type Value } from "../database/database";
import { migrations, tables, type Table } from "../database/migrations";
import { BackupService, checksum, type Backup } from "../services/backup";
import type { CloudStore } from "./store";
export interface CloudDatabase {
  db: Database;
  reload(): Promise<void>;
  checkForUpdates(): Promise<boolean>;
  dispose(): void;
  revision(): number;
}
// Run the existing validated ledgers locally, then atomically persist their complete
// JSON document in Postgres. Compare-and-swap prevents stale phones overwriting it.
// No farm data is stored in a shared browser cache; Supabase is authoritative.
export async function openCloudDatabase(
  SQL: SqlJsStatic,
  store: CloudStore,
): Promise<CloudDatabase> {
  let engine: SQLite = new SQL.Database(),
    enabled = false,
    active = true;
  let revision = 0,
    stable: Uint8Array,
    blocked = false;
  function query(sql: string, values: Value[] = []): Row[] {
    const statement = engine.prepare(sql);
    try {
      statement.bind(values);
      const rows: Row[] = [];
      while (statement.step()) rows.push(statement.getAsObject() as Row);
      return rows;
    } finally {
      statement.free();
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
  const db = new Database({
    query: async (sql, values) => query(sql, values),
    execute: async (sql, values) => {
      if (enabled && (!active || blocked) && sql === "BEGIN TRANSACTION")
        throw new Error("Reload your farm before saving another change.");
      engine.run(sql, values);
    },
    persist: async () => {
      if (!enabled) return;
      const requestId = crypto.randomUUID();
      try {
        if (!active || blocked)
          throw new Error(
            "This session has closed. Sign in again before saving.",
          );
        const data = Object.fromEntries(
          tables.map((t) => [t, query(`SELECT * FROM ${t} ORDER BY id`)]),
        ) as Record<Table, Row[]>;
        const document: Backup = {
          format: "FarmTrack",
          version: 1,
          schemaVersion: migrations.at(-1)!.version,
          exportedAt: new Date().toISOString(),
          data,
          checksum: await checksum(data),
        };
        let saved;
        try {
          saved = await store.write(document, revision, requestId);
        } catch (error) {
          // If the response was lost after commit, acknowledge this exact request.
          const observed = await store.read().catch(() => null);
          if (observed?.mutation_id !== requestId) throw error;
          saved = observed;
        }
        revision = saved.revision;
        stable = capture();
      } catch (error) {
        restore(stable);
        blocked = true;
        throw error;
      }
    },
  });
  await db.migrate();
  stable = capture();
  const empty = stable;
  async function load() {
    const record = await store.read();
    const previous = stable,
      previousRevision = revision;
    enabled = false;
    try {
      if (record) {
        await new BackupService(new Database(db.driver)).import(
          JSON.stringify(record.document),
        );
        revision = record.revision;
      } else {
        restore(empty);
        revision = 0;
      }
      stable = capture();
      blocked = false;
    } catch (error) {
      restore(previous);
      revision = previousRevision;
      throw error;
    } finally {
      enabled = true;
    }
  }
  // load() uses db.transaction; callers serialize reload separately from user writes.
  await db.exclusive(load);
  return {
    db,
    reload: () => db.exclusive(load),
    async checkForUpdates() {
      const record = await store.read();
      return (record?.revision ?? 0) !== revision;
    },
    dispose() {
      active = false;
    },
    revision: () => revision,
  };
}
