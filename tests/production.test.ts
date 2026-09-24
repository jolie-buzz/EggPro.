import { it, expect } from "vitest";
import { fixture } from "./helpers";
import { ProductionRepository } from "../src/repositories/production";
import {
  rate,
  trays,
  perKg,
  perEgg,
  weightedCost,
  today,
  shiftDate,
} from "../src/utils/calculations";
it("calculates production, tray conversion and feed costs safely", () => {
  expect(rate(162, 200)).toBe(81);
  expect(rate(1, 0)).toBe(0);
  expect(trays(45)).toBe(1.5);
  expect(perKg(1530, 50)).toBe(30.6);
  expect(perEgg(673.2, 162)).toBeCloseTo(4.15556);
  expect(perEgg(20, 0)).toBe(0);
  expect(weightedCost(50, 30, 50, 2000)).toBe(35);
});
it("autosaves once per cage/day, keeps snapshots and preserves inactive history", async () => {
  const { db, farm } = await fixture();
  const repo = new ProductionRepository(db);
  const c = (await farm.snapshot()).cages[0];
  await repo.save(today(), c.id, 3);
  await farm.saveCage({ ...c, hen_count: 8 }, c.id);
  await repo.save(today(), c.id, 4);
  let s = await farm.snapshot();
  expect(s.daily_production).toHaveLength(1);
  expect(s.daily_production[0].hen_count_snapshot).toBe(4);
  await farm.saveCage({ ...c, status: "inactive" }, c.id);
  s = await farm.snapshot();
  expect(s.daily_production).toHaveLength(1);
});
it("detects 3 consecutive recorded low days and removes corrected alert", async () => {
  const { db, farm } = await fixture();
  const repo = new ProductionRepository(db),
    c = (await farm.snapshot()).cages[0];
  for (const n of [0, -2, -4]) await repo.save(shiftDate(today(), n), c.id, 1);
  expect((await farm.snapshot()).alerts).toHaveLength(1);
  await repo.save(today(), c.id, 3);
  expect((await farm.snapshot()).alerts).toHaveLength(0);
  await expect(repo.save(today(), c.id, -1)).rejects.toThrow();
});
it("keeps production snapshots across daily bulk operations", async () => {
  const { db, farm } = await fixture();
  const repo = new ProductionRepository(db);
  const c = (await farm.snapshot()).cages[0];
  await repo.save(today(), c.id, 3);
  await farm.saveCage({ ...c, hen_count: 8 }, c.id);
  await repo.bulk(today(), "zero");
  expect(
    (await farm.snapshot()).daily_production.find((r) => r.cage_id === c.id)
      ?.hen_count_snapshot,
  ).toBe(4);
  await repo.bulk(today(), "clear");
  expect((await farm.snapshot()).daily_production).toHaveLength(0);
});
