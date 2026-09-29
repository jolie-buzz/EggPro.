import { z } from "zod";

export const cageGroupSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    notes: z.string().max(500),
    cageIds: z.array(z.string().min(1)).min(1).max(5000),
  })
  .strict();
export type CageGroup = z.infer<typeof cageGroupSchema>;

export function parseCageGroups(
  value: string | undefined,
  cageIds: string[],
): CageGroup[] {
  if (value === undefined) return [];
  const groups = z.array(cageGroupSchema).max(100).parse(JSON.parse(value));
  const known = new Set(cageIds);
  if (
    new Set(groups.map((g) => g.id)).size !== groups.length ||
    new Set(groups.map((g) => g.name.toLowerCase())).size !== groups.length
  )
    throw new Error("Group names must be unique.");
  for (const group of groups) {
    if (
      new Set(group.cageIds).size !== group.cageIds.length ||
      group.cageIds.some((id) => !known.has(id))
    )
      throw new Error("Group contains duplicate or unknown cages.");
  }
  return groups;
}
