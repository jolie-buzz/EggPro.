import { it, expect } from "vitest";
import init from "sql.js";
import { openOfflineDatabase } from "../src/cloud/offline";
import type { LocalCache, OfflineEnvelope } from "../src/cloud/local-cache";
import type { CloudStore, CloudRecord } from "../src/cloud/store";
import { FarmRepository } from "../src/repositories/farm";
import { InventoryRepository } from "../src/repositories/inventory";
import { today } from "../src/utils/calculations";
const setup = {
  name: "QA Offline Farm",
  owner: "",
  cages: 2,
  hens: 4,
  currency: "PHP" as const,
  prices: { Small: 200, Medium: 225, Large: 250, XL: 275 },
  sackWeight: 50,
  cost: 1500,
};
function cache() {
  let data: OfflineEnvelope | null = null,
    fail = false;
  const storage: LocalCache = {
    read: async () => structuredClone(data),
    save: async (next, expected) => {
      if (fail) throw new Error("Storage full");
      if (expected !== (data?.serial ?? 0)) throw new Error("Another window");
      data = structuredClone(next);
    },
  };
  return {
    storage,
    fail: () => {
      fail = true;
    },
    get: () => data,
  };
}
function server() {
  let data: CloudRecord | null = null,
    online = true,
    lose = false;
  const store: CloudStore = {
    read: async () => {
      if (!online) throw new Error("Offline");
      return structuredClone(data);
    },
    write: async (document, revision, id) => {
      if (!online) throw new Error("Offline");
      if ((data?.revision ?? 0) !== revision) throw new Error("Conflict");
      data = {
        document: structuredClone(document),
        revision: revision + 1,
        mutation_id: id,
        updated_at: new Date().toISOString(),
      };
      if (lose) {
        online = false;
        throw new Error("Lost response");
      }
      return structuredClone(data);
    },
  };
  return {
    store,
    setOnline: (v: boolean) => {
      online = v;
    },
    loseResponse: () => {
      lose = true;
    },
    get: () => data,
  };
}
it("saves offline, survives closing, then syncs once and opens on another phone", async () => {
  const SQL = await init(),
    cloud = server(),
    disk = cache();
  let phone = await openOfflineDatabase(SQL, cloud.store, disk.storage);
  await new FarmRepository(phone.db).setup(setup);
  await phone.sync();
  cloud.setOnline(false);
  await new InventoryRepository(phone.db).addSize("Jumbo", 300);
  await new InventoryRepository(phone.db).sort(today(), { Jumbo: 30 });
  expect(phone.status().pending).toBe(true);
  await phone.sync();
  expect(phone.status().pending).toBe(true);
  phone.dispose();
  phone = await openOfflineDatabase(SQL, cloud.store, disk.storage);
  expect(
    (await new FarmRepository(phone.db).snapshot()).egg_inventory.find(
      (r) => r.id === "Jumbo",
    )?.quantity,
  ).toBe(30);
  cloud.setOnline(true);
  await phone.sync();
  await phone.sync();
  expect(phone.status().pending).toBe(false);
  expect(cloud.get()?.revision).toBe(2);
  const other = await openOfflineDatabase(SQL, cloud.store, cache().storage);
  expect(
    (await new FarmRepository(other.db).snapshot()).egg_inventory.find(
      (r) => r.id === "Jumbo",
    )?.quantity,
  ).toBe(30);
});
it("preserves both conflicting versions and keeps durable recovery copies before choosing", async () => {
  const SQL = await init(),
    cloud = server(),
    a = cache(),
    b = cache();
  const first = await openOfflineDatabase(SQL, cloud.store, a.storage);
  await new FarmRepository(first.db).setup(setup);
  await first.sync();
  const second = await openOfflineDatabase(SQL, cloud.store, b.storage);
  await new InventoryRepository(first.db).addSize("Jumbo", 300);
  await new InventoryRepository(second.db).addSize("Peewee", 100);
  await first.sync();
  await second.sync();
  expect(second.status().conflict).toBe(true);
  expect(second.status().pending).toBe(true);
  expect(
    second.copies().phone.data.egg_inventory.some((r) => r.id === "Peewee"),
  ).toBe(true);
  expect(
    second.copies().cloud?.data.egg_inventory.some((r) => r.id === "Jumbo"),
  ).toBe(true);
  await expect(second.reload()).rejects.toThrow("unsynced");
  await second.resolve("cloud");
  expect(second.status().pending).toBe(false);
  expect(second.copies().recovery).toHaveLength(2);
  second.dispose();
  const reopened = await openOfflineDatabase(SQL, cloud.store, b.storage);
  expect(reopened.copies().recovery).toHaveLength(2);
  expect(
    (await new FarmRepository(reopened.db).snapshot()).egg_inventory.some(
      (r) => r.id === "Jumbo",
    ),
  ).toBe(true);
});
it("recognizes an uploaded pending mutation after a lost response and restart", async () => {
  const SQL = await init(),
    cloud = server(),
    disk = cache();
  let phone = await openOfflineDatabase(SQL, cloud.store, disk.storage);
  await new FarmRepository(phone.db).setup(setup);
  cloud.loseResponse();
  await phone.sync();
  expect(phone.status().pending).toBe(true);
  expect(cloud.get()?.revision).toBe(1);
  phone.dispose();
  cloud.setOnline(true);
  phone = await openOfflineDatabase(SQL, cloud.store, disk.storage);
  await phone.sync();
  expect(phone.status().pending).toBe(false);
  expect(cloud.get()?.revision).toBe(1);
});
it("rejects a first offline login rather than creating an empty replacement farm, and handles disk failure", async () => {
  const SQL = await init(),
    cloud = server(),
    disk = cache();
  cloud.setOnline(false);
  await expect(
    openOfflineDatabase(SQL, cloud.store, disk.storage),
  ).rejects.toThrow("Offline");
  cloud.setOnline(true);
  const phone = await openOfflineDatabase(SQL, cloud.store, disk.storage);
  await new FarmRepository(phone.db).setup(setup);
  disk.fail();
  await expect(
    new InventoryRepository(phone.db).addSize("Jumbo", 300),
  ).rejects.toThrow("Storage full");
  expect(
    (await new FarmRepository(phone.db).snapshot()).egg_inventory,
  ).toHaveLength(4);
});
it("reopens a cached account that has not completed setup yet", async () => {
  const SQL = await init(),
    cloud = server(),
    disk = cache();
  const phone = await openOfflineDatabase(SQL, cloud.store, disk.storage);
  phone.dispose();
  cloud.setOnline(false);
  const reopened = await openOfflineDatabase(SQL, cloud.store, disk.storage);
  await new FarmRepository(reopened.db).setup(setup);
  expect(reopened.status().pending).toBe(true);
});
it("rejects stale tabs sharing a device cache without losing the other tab records", async () => {
  const SQL = await init(),
    cloud = server(),
    disk = cache();
  const a = await openOfflineDatabase(SQL, cloud.store, disk.storage);
  await new FarmRepository(a.db).setup(setup);
  const b = await openOfflineDatabase(SQL, cloud.store, disk.storage);
  await new InventoryRepository(a.db).addSize("Jumbo", 300);
  await expect(
    new InventoryRepository(b.db).addSize("Peewee", 100),
  ).rejects.toThrow("Another window");
  expect(
    disk.get()?.document.data.egg_inventory.some((r) => r.id === "Jumbo"),
  ).toBe(true);
});
it("allows phone saves during a slow upload and syncs the newer edits next", async () => {
  const SQL = await init(),
    cloud = server(),
    disk = cache();
  const phone = await openOfflineDatabase(SQL, cloud.store, disk.storage);
  await new FarmRepository(phone.db).setup(setup);
  const write = cloud.store.write;
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    entered = new Promise<void>((r) => (started = r));
  cloud.store.write = async (...args) => {
    started();
    await gate;
    return write(...args);
  };
  const syncing = phone.sync();
  await entered;
  await new InventoryRepository(phone.db).addSize("During upload", 300);
  expect(disk.get()?.pending).toBe(true);
  release();
  await syncing;
  expect(phone.status().pending).toBe(true);
  expect(
    cloud
      .get()
      ?.document.data.egg_inventory.some((r) => r.id === "During upload"),
  ).toBe(false);
  await phone.sync();
  expect(phone.status().pending).toBe(false);
  expect(
    cloud
      .get()
      ?.document.data.egg_inventory.some((r) => r.id === "During upload"),
  ).toBe(true);
});
