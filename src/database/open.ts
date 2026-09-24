import { Capacitor } from "@capacitor/core";
import { Database, type Driver } from "./database";
let opening: Promise<Database> | undefined;
export function openDatabase() {
  return (opening ??= open());
}
async function open() {
  let driver: Driver;
  if (Capacitor.isNativePlatform()) {
    const { CapacitorSQLite, SQLiteConnection } =
      await import("@capacitor-community/sqlite");
    const connections = new SQLiteConnection(CapacitorSQLite);
    const db = await connections.createConnection(
      "farmtrack",
      false,
      "no-encryption",
      1,
      false,
    );
    await db.open();
    driver = {
      query: async (sql, values) => (await db.query(sql, values)).values ?? [],
      execute: async (sql, values) => {
        if (values?.length) await db.run(sql, values, false);
        else await db.execute(sql, false);
      },
      persist: async () => {},
    };
  } else {
    // Development preview: real SQLite WASM, persisted in IndexedDB. Native builds use the OS database.
    const [{ default: init }, { get, set }] = await Promise.all([
      import("sql.js"), import("idb-keyval"),
    ]);
    const SQL = await init({locateFile: () => new URL("sql-wasm.wasm", document.baseURI).href});
    const saved = await get<Uint8Array>("farmtrack-sqlite");
    let db = new SQL.Database(saved);
    let lastSaved = db.export();
    driver = {
      query: async (sql, values = []) => {
        const s = db.prepare(sql);
        try {
          s.bind(values);
          const rows = [];
          while (s.step())
            rows.push(s.getAsObject() as import("./database").Row);
          return rows;
        } finally {
          s.free();
        }
      },
      execute: async (sql, values) => {
        db.run(sql, values);
      },
      persist: async () => {
        const bytes = db.export();
        try {
          await set("farmtrack-sqlite", bytes);
          lastSaved = bytes;
        } catch (error) {
          db.close();
          db = new SQL.Database(lastSaved);
          throw new Error(
            "Could not save to device storage. Your last saved data was kept. Free some storage and try again.",
            { cause: error },
          );
        } finally {
          db.run("PRAGMA foreign_keys=ON");
        }
      },
    };
  }
  const database = new Database(driver);
  await database.migrate();
  return database;
}
