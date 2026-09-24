import { Capacitor } from "@capacitor/core";
import type { Backup } from "../services/backup";
import type { CloudRecord } from "./store";
export interface RecoveryCopy {
  date: string;
  label: string;
  document: Backup;
}
export interface OfflineEnvelope {
  version: 1;
  serial: number;
  document: Backup;
  baseRevision: number;
  pending: boolean;
  mutationId: string;
  lastSynced: string | null;
  recovery: RecoveryCopy[];
  conflict?: { remote: CloudRecord | null };
}
export interface LocalCache {
  read(): Promise<OfflineEnvelope | null>;
  save(next: OfflineEnvelope, expectedSerial: number): Promise<void>;
}
const changed = () =>
  new Error(
    "This farm changed in another app window. Reopen EggPro before saving; your current entry was not saved.",
  );
let nativeOpening:
  Promise<import("@capacitor-community/sqlite").SQLiteDBConnection> | undefined;
async function nativeStore() {
  return (nativeOpening ??= (async () => {
    const { CapacitorSQLite, SQLiteConnection } =
      await import("@capacitor-community/sqlite");
    const connection = await new SQLiteConnection(
      CapacitorSQLite,
    ).createConnection("eggpro_offline", false, "no-encryption", 1, false);
    await connection.open();
    await connection.execute(
      "CREATE TABLE IF NOT EXISTS account_cache(id TEXT PRIMARY KEY, serial INTEGER NOT NULL, data TEXT NOT NULL);",
      false,
    );
    return connection;
  })());
}
export function accountCache(owner: string, project: string): LocalCache {
  const key = `eggpro-offline:${project}:${owner}`;
  if (Capacitor.isNativePlatform())
    return {
      async read() {
        const db = await nativeStore();
        const row = (
          await db.query("SELECT data FROM account_cache WHERE id=?", [key])
        ).values?.[0];
        return row ? JSON.parse(row.data) : null;
      },
      async save(next, expectedSerial) {
        const db = await nativeStore();
        const result = await db.run(
          "INSERT INTO account_cache(id,serial,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET serial=excluded.serial,data=excluded.data WHERE account_cache.serial=?",
          [key, next.serial, JSON.stringify(next), expectedSerial],
          false,
        );
        if (result.changes?.changes !== 1) throw changed();
      },
    };
  return {
    async read() {
      const { get } = await import("idb-keyval");
      return (await get<OfflineEnvelope>(key)) ?? null;
    },
    async save(next, expectedSerial) {
      const { update } = await import("idb-keyval");
      await update(key, (old: OfflineEnvelope | undefined) => {
        if ((old?.serial ?? 0) !== expectedSerial) throw changed();
        return next;
      });
    },
  };
}
