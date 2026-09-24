import init from "sql.js";
import { Database } from "../src/database/database";
import { FarmRepository } from "../src/repositories/farm";
export async function fixture(count = 2, legacy = false) {
  const SQL = await init();
  const engine = new SQL.Database();
  const db = new Database({
    query: async (s, v = []) => {
      const q = engine.prepare(s);
      try {
        q.bind(v);
        const rows = [];
        while (q.step())
          rows.push(q.getAsObject() as import("../src/database/database").Row);
        return rows;
      } finally {
        q.free();
      }
    },
    execute: async (s, v) => {
      engine.run(s, v);
    },
    persist: async () => {},
  });
  if (legacy) {
    const { migrations } = await import("../src/database/migrations");
    await db.execute("PRAGMA foreign_keys = ON");
    await db.execute(
      "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY)",
    );
    await db.execute(migrations[0].sql);
    await db.execute("INSERT INTO schema_migrations VALUES (1)");
  } else await db.migrate();
  const farm = new FarmRepository(db);
  await farm.setup({
    name: "Test Farm",
    owner: "",
    cages: count,
    hens: 4,
    currency: "PHP",
    prices: { Small: 205, Medium: 225, Large: 245, XL: 255 },
    sackWeight: 50,
    cost: 1530,
  });
  return { db, farm, engine };
}
