import { Database } from "../database/database";
import { assert } from "./validation";
// Sorting on a date is available for all sales dated that day.
export async function auditEggTimeline(db: Database) {
  const movements = await db.query<{
    date: string;
    size: string;
    delta: number;
  }>(`SELECT date,size,SUM(delta) AS delta FROM (
SELECT date,size,quantity AS delta FROM egg_sorting WHERE size IN (SELECT id FROM egg_inventory)
UNION ALL SELECT s.date,i.size,-i.eggs AS delta FROM sale_items i JOIN sales s ON s.id=i.sale_id
) GROUP BY date,size ORDER BY date,size`);
  const balances: Record<string, number> = {};
  for (const m of movements) {
    balances[m.size] = (balances[m.size] ?? 0) + m.delta;
    assert(
      balances[m.size] >= 0,
      `Not enough ${m.size} eggs on ${m.date}. This change would make historical stock negative. Check the collection and sale dates.`,
    );
  }
}
