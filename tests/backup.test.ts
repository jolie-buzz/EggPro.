import { it, expect } from "vitest";
import { fixture } from "./helpers";
import {
  BackupService,
  checksum,
  validateBackup,
} from "../src/services/backup";
import { ProductionRepository } from "../src/repositories/production";
import { today } from "../src/utils/calculations";
it("round trips a complete local backup", async () => {
  const { db, farm } = await fixture();
  const prod = new ProductionRepository(db),
    backup = new BackupService(db);
  const cage = (await farm.snapshot()).cages[0];
  await prod.save(today(), cage.id, 4);
  const data = await backup.export();
  await prod.save(today(), cage.id, 1);
  await backup.import(JSON.stringify(data));
  expect((await farm.snapshot()).daily_production[0].egg_count).toBe(4);
});
it("rejects damaged data before replacing the farm", async () => {
  const { db, farm } = await fixture();
  const b = new BackupService(db),
    data = await b.export();
  data.data.farms[0].name = "Tampered";
  await expect(b.import(JSON.stringify(data))).rejects.toThrow("checksum");
  expect((await farm.snapshot()).farms[0].name).toBe("Test Farm");
  await expect(validateBackup("{}")).rejects.toThrow();
});
it("rolls back restore with broken references or inconsistent inventory", async () => {
  const { db, farm } = await fixture();
  const b = new BackupService(db),
    data = await b.export();
  data.data.cages[0].farm_id = "missing";
  data.checksum = await checksum(data.data);
  await expect(b.import(JSON.stringify(data))).rejects.toThrow();
  expect((await farm.snapshot()).cages[0].farm_id).not.toBe("missing");
  const data2 = await b.export();
  data2.data.egg_inventory[0].quantity = 500;
  data2.checksum = await checksum(data2.data);
  await expect(b.import(JSON.stringify(data2))).rejects.toThrow("inventory");
  expect((await farm.snapshot()).egg_inventory[0].quantity).toBe(0);
});
it("rejects invalid row types and mismatched payment totals with rollback", async () => {
  const { db, farm } = await fixture();
  const b = new BackupService(db),
    data = await b.export();
  data.data.cages[0].hen_count = "4";
  data.checksum = await checksum(data.data);
  await expect(b.import(JSON.stringify(data))).rejects.toThrow();
  expect((await farm.snapshot()).cages[0].hen_count).toBe(4);
});
