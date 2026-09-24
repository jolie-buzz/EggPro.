import { it, expect } from "vitest";
import init from "sql.js";
import { openCloudDatabase } from "../src/cloud/database";
import type { CloudRecord, CloudStore } from "../src/cloud/store";
import { FarmRepository } from "../src/repositories/farm";
import { InventoryRepository } from "../src/repositories/inventory";
import { SalesRepository } from "../src/repositories/sales";
import { BackupService } from "../src/services/backup";
import { today } from "../src/utils/calculations";
const setup = {
  name: "QA Online Farm",
  owner: "",
  cages: 2,
  hens: 4,
  currency: "PHP" as const,
  prices: { Small: 200, Medium: 225, Large: 250, XL: 275 },
  sackWeight: 50,
  cost: 1500,
};
function memoryStore() {
  let record: CloudRecord | null = null,
    fail = false,
    loseResponse = false;
  const store: CloudStore = {
    read: async () => structuredClone(record),
    write: async (document, revision, mutationId) => {
      if (fail) throw new Error("Network unavailable; reload before retrying.");
      if (revision !== (record?.revision ?? 0))
        throw new Error("Another phone has updated this farm.");
      record = {
        document: structuredClone(document),
        revision: revision + 1,
        mutation_id: mutationId,
        updated_at: new Date().toISOString(),
      };
      if (loseResponse) throw new Error("Response lost");
      return structuredClone(record);
    },
  };
  return {
    store,
    setFail: (v: boolean) => {
      fail = v;
    },
    loseResponse: () => {
      loseResponse = true;
    },
    record: () => record,
  };
}
it("opens the same account on a second phone, persists custom sizes, and protects stale saves", async () => {
  const SQL = await init(),
    server = memoryStore();
  const first = await openCloudDatabase(SQL, server.store);
  const farm = new FarmRepository(first.db);
  await farm.setup(setup);
  const second = await openCloudDatabase(SQL, server.store);
  expect((await new FarmRepository(second.db).snapshot()).farms[0].name).toBe(
    setup.name,
  );
  const inventory = new InventoryRepository(first.db);
  await inventory.addSize("Jumbo", 300);
  await inventory.sort(today(), { Jumbo: 30 });
  await expect(
    new InventoryRepository(second.db).addSize("Peewee", 100),
  ).rejects.toThrow("Another phone");
  expect(
    (await new FarmRepository(second.db).snapshot()).egg_inventory.some(
      (r) => r.id === "Peewee",
    ),
  ).toBe(false);
  await expect(
    new InventoryRepository(second.db).addSize("Peewee", 100),
  ).rejects.toThrow("Reload");
  await second.reload();
  expect(
    (await new FarmRepository(second.db).snapshot()).egg_inventory.find(
      (r) => r.id === "Jumbo",
    )?.quantity,
  ).toBe(30);
  await new SalesRepository(second.db).save({
    customerId: null,
    date: today(),
    items: [{ size: "Jumbo", quantity: 1, unit: "Tray", price: 30000 }],
    discount: 0,
    paid: 30000,
    method: "Cash",
    notes: "",
  });
  await first.reload();
  expect(
    (await farm.snapshot()).egg_inventory.find((r) => r.id === "Jumbo")
      ?.quantity,
  ).toBe(0);
  expect((await farm.snapshot()).sales).toHaveLength(1);
  expect(server.record()?.revision).toBe(4);
});
it("rolls back failed cloud saves, blocks retries until reload, and handles lost acknowledgements", async () => {
  const SQL = await init(),
    server = memoryStore(),
    connection = await openCloudDatabase(SQL, server.store),
    farm = new FarmRepository(connection.db);
  await farm.setup(setup);
  server.setFail(true);
  await expect(
    new InventoryRepository(connection.db).addSize("Jumbo", 300),
  ).rejects.toThrow("Network");
  expect((await farm.snapshot()).egg_inventory).toHaveLength(4);
  server.setFail(false);
  await connection.reload();
  server.loseResponse();
  await new InventoryRepository(connection.db).addSize("Jumbo", 300);
  expect((await farm.snapshot()).egg_inventory).toHaveLength(5);
  expect(connection.revision()).toBe(2);
  connection.dispose();
  await expect(
    new InventoryRepository(connection.db).addSize("Peewee", 100),
  ).rejects.toThrow();
});
it("keeps accounts separate and imports a legacy backup into an empty online account", async () => {
  const SQL = await init(),
    a = memoryStore(),
    b = memoryStore();
  const first = await openCloudDatabase(SQL, a.store),
    second = await openCloudDatabase(SQL, b.store);
  await new FarmRepository(first.db).setup(setup);
  expect((await new FarmRepository(second.db).snapshot()).farms).toHaveLength(
    0,
  );
  const backup = await new BackupService(first.db).export();
  backup.schemaVersion = 1;
  await new BackupService(second.db).import(JSON.stringify(backup));
  expect((await new FarmRepository(second.db).snapshot()).farms[0].name).toBe(
    setup.name,
  );
  expect(b.record()?.revision).toBe(1);
});
it("validates cloud documents after Postgres JSONB reorders object properties", async () => {
  const SQL = await init(),
    server = memoryStore(),
    first = await openCloudDatabase(SQL, server.store);
  await new FarmRepository(first.db).setup(setup);
  const reorder = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(reorder)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .reverse()
              .map(([k, x]) => [k, reorder(x)]),
          )
        : v;
  const jsonbStore: CloudStore = {
    ...server.store,
    read: async () => reorder(await server.store.read()) as CloudRecord,
  };
  const second = await openCloudDatabase(SQL, jsonbStore);
  expect((await new FarmRepository(second.db).snapshot()).farms[0].name).toBe(
    setup.name,
  );
});
