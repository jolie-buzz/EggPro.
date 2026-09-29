import { expect, it } from "vitest";
import { fixture } from "./helpers";
import { ProductionRepository } from "../src/repositories/production";
import { productivity } from "../src/services/productivity";
import { rankings } from "../src/services/analytics";
import { today, shiftDate } from "../src/utils/calculations";

it("weights cage and group productivity by historical hen counts and filters dates", async () => {
  const { db, farm } = await fixture(3);
  const [a, b, c] = (await farm.snapshot()).cages;
  const repo = new ProductionRepository(db);
  const yesterday = shiftDate(today(), -1);
  await repo.save(yesterday, a.id, 4);
  await farm.saveCage({ ...a, hen_count: 8 }, a.id);
  await repo.save(today(), a.id, 4);
  await repo.save(today(), b.id, 1);
  await repo.save(shiftDate(today(), -3), c.id, 4);
  await farm.saveCage({ ...a, hen_count: 20, status: "inactive" }, a.id);
  const state = await farm.snapshot();
  const single = productivity(state, yesterday, today(), [a.id]);
  expect(single.eggs).toBe(8);
  expect(single.rate).toBeCloseTo((100 * 8) / 12);
  expect(single.cages[0].days).toBe(2);
  expect(single.series.map((d) => d.rate)).toEqual([100, 50]);
  const group = productivity(state, yesterday, today(), [a.id, b.id, c.id]);
  expect(group.eggs).toBe(9);
  expect(group.rate).toBeCloseTo((100 * 9) / 16);
  expect(group.recordedCages).toBe(2);
  expect(group.cages.find((r) => r.cage.id === c.id)?.rate).toBeNull();
  expect(
    rankings(state, yesterday, today()).find((r) => r.cage.id === a.id)?.rate,
  ).toBeCloseTo(single.rate!);
  expect(productivity(state, today(), today(), [a.id]).rate).toBe(50);
});

it("distinguishes recorded zero eggs, missing days, no records and an empty selection", async () => {
  const { db, farm } = await fixture();
  const [a, b] = (await farm.snapshot()).cages;
  await new ProductionRepository(db).save(today(), a.id, 0);
  const state = await farm.snapshot();
  const result = productivity(state, shiftDate(today(), -1), today(), [
    a.id,
    b.id,
  ]);
  expect(result.rate).toBe(0);
  expect(result.series[0]).toMatchObject({
    eggs: null,
    rate: null,
    recorded: 0,
  });
  expect(result.series[1]).toMatchObject({ eggs: 0, rate: 0, recorded: 1 });
  expect(result.cages.find((r) => r.cage.id === b.id)).toMatchObject({
    days: 0,
    rate: null,
  });
  expect(productivity(state, today(), today(), [])).toMatchObject({
    eggs: 0,
    rate: null,
    cages: [],
    recordedCages: 0,
  });
});
