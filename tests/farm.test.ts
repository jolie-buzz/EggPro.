import { describe, it, expect } from "vitest";
import { fixture } from "./helpers";
describe("phase 1: farm and migrations", () => {
  it("creates requested cages and clean inventories; migrations are idempotent", async () => {
    const { db, farm } = await fixture(50);
    await db.migrate();
    const s = await farm.snapshot();
    expect(s.cages).toHaveLength(50);
    expect(s.cages[49].cage_number).toBe("050");
    expect(s.cages.reduce((n, c) => n + c.hen_count, 0)).toBe(200);
    expect(s.egg_inventory.every((r) => r.quantity === 0)).toBe(true);
    await expect(farm.setup({} as never)).rejects.toThrow();
  });
  it("enforces cage uniqueness and soft deactivation", async () => {
    const { farm } = await fixture();
    const c = (await farm.snapshot()).cages[0];
    await farm.saveCage({ ...c, status: "inactive" }, c.id);
    expect((await farm.snapshot()).cages[0].status).toBe("inactive");
    await expect(farm.saveCage(c)).rejects.toThrow();
    expect((await farm.snapshot()).cages).toHaveLength(2);
  });
});
