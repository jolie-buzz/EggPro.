import { it, expect } from "vitest";
import { fixture } from "./helpers";
import { parseCageGroups } from "../src/services/cage-groups";
import {
  BackupService,
  checksum,
  validateBackup,
} from "../src/services/backup";
import { ProductionRepository } from "../src/repositories/production";
import { today, status } from "../src/utils/calculations";
it("saves, edits, restores and deletes groups without modifying cages or production", async () => {
  const { db, farm } = await fixture();
  const [a, b] = (await farm.snapshot()).cages;
  await new ProductionRepository(db).save(today(), a.id, 3);
  const backup = new BackupService(db);
  const legacy = await backup.export();
  await farm.saveGroup({
    name: "Group 1",
    notes: "18 months old",
    cageIds: [a.id],
  });
  let groups = parseCageGroups((await farm.snapshot()).settings.cage_groups, [
    a.id,
    b.id,
  ]);
  const saved = await backup.export();
  await farm.saveGroup(
    { name: "Group 1 – Older", notes: "Older batch", cageIds: [a.id, b.id] },
    groups[0].id,
  );
  await backup.import(JSON.stringify(saved));
  groups = parseCageGroups((await farm.snapshot()).settings.cage_groups, [
    a.id,
    b.id,
  ]);
  expect(groups[0]).toMatchObject({
    name: "Group 1",
    notes: "18 months old",
    cageIds: [a.id],
  });
  await farm.deleteGroup(groups[0].id);
  const state = await farm.snapshot();
  expect(JSON.parse(state.settings.cage_groups)).toEqual([]);
  expect(state.cages).toHaveLength(2);
  expect(state.daily_production[0].egg_count).toBe(3);
  await backup.import(JSON.stringify(legacy));
  expect((await farm.snapshot()).settings.cage_groups).toBeUndefined();
});
it("rejects empty, duplicate and broken group memberships including backup input", async () => {
  const { db, farm } = await fixture();
  const [a] = (await farm.snapshot()).cages;
  await farm.saveGroup({ name: "Group 1", notes: "", cageIds: [a.id] });
  await expect(
    farm.saveGroup({ name: "group 1", notes: "", cageIds: [a.id] }),
  ).rejects.toThrow("unique");
  await expect(
    farm.saveGroup({ name: "Empty", notes: "", cageIds: [] }),
  ).rejects.toThrow();
  await expect(
    farm.saveGroup({ name: "Bad", notes: "", cageIds: ["missing"] }),
  ).rejects.toThrow("unknown");
  await expect(
    farm.saveGroup({ name: "Bad", notes: "", cageIds: [a.id, a.id] }),
  ).rejects.toThrow("duplicate");
  const saved = await new BackupService(db).export();
  const setting = saved.data.settings.find((r) => r.id === "cage_groups")!;
  const groups = JSON.parse(String(setting.value));
  groups[0].cageIds = ["missing"];
  setting.value = JSON.stringify(groups);
  saved.checksum = await checksum(saved.data);
  await expect(validateBackup(JSON.stringify(saved))).rejects.toThrow(
    "unknown",
  );
});
it("keeps warning thresholds and missing records distinct", () => {
  expect([null, 0, 49.9, 50, 74.9, 75, 100].map(status)).toEqual([
    "unrecorded",
    "low",
    "low",
    "watch",
    "watch",
    "good",
    "good",
  ]);
});
