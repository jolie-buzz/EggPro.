import { Database, type Row, type Value } from "../database/database";
import { tables } from "../database/migrations";
import type { State, Cage } from "../types/models";
import { cents, sizes } from "../utils/calculations";
import {
  assert,
  integer,
  note,
  setupSchema,
  text,
  type SetupInput,
} from "../services/validation";
export const id = () => crypto.randomUUID();
export const stamp = () => new Date().toISOString();
export async function insert(
  db: Database,
  table: string,
  data: Record<string, Value>,
) {
  const keys = Object.keys(data);
  await db.execute(
    `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    Object.values(data),
  );
}
export class FarmRepository {
  constructor(public db: Database) {}
  async snapshot(): Promise<State> {
    return this.db.exclusive(async () => {
      const data: Record<string, unknown> = {};
      for (const t of tables)
        data[t] = await this.db.query(`SELECT * FROM ${t}`);
      data.settings = Object.fromEntries(
        (data.settings as Row[]).map((r) => [r.id, r.value]),
      );
      return data as unknown as State;
    });
  }
  async setup(input: SetupInput) {
    const v = setupSchema.parse(input);
    await this.db.transaction(async () => {
      assert(
        (await this.db.query("SELECT id FROM farms")).length === 0,
        "This farm is already set up.",
      );
      const now = stamp(),
        farmId = id();
      await insert(this.db, "farms", {
        id: farmId,
        name: v.name,
        owner: v.owner,
        created_at: now,
        updated_at: now,
      });
      for (const [key, value] of Object.entries({
        currency: v.currency,
        prices: JSON.stringify(
          Object.fromEntries(sizes.map((s) => [s, cents(v.prices[s] ?? 0)])),
        ),
      }))
        await insert(this.db, "settings", { id: key, value, updated_at: now });
      for (let n = 1; n <= v.cages; n++)
        await insert(this.db, "cages", {
          id: id(),
          farm_id: farmId,
          cage_number: String(n).padStart(3, "0"),
          name: "",
          hen_count: v.hens,
          status: "active",
          notes: "",
          created_at: now,
          updated_at: now,
        });
      for (const size of sizes)
        await insert(this.db, "egg_inventory", {
          id: size,
          quantity: 0,
          updated_at: now,
        });
      await insert(this.db, "feed_items", {
        id: id(),
        name: "Layer Mash",
        brand: "",
        sack_weight_kg: v.sackWeight,
        cost_per_sack: cents(v.cost),
        quantity_kg: 0,
        average_cost: 0,
        reorder_level_kg: 50,
        created_at: now,
        updated_at: now,
      });
    });
  }
  async saveCage(
    input: Pick<
      Cage,
      "cage_number" | "name" | "hen_count" | "status" | "notes"
    >,
    cageId?: string,
  ) {
    text.parse(input.cage_number);
    integer.parse(input.hen_count);
    note.parse(input.notes);
    assert(
      ["active", "inactive"].includes(input.status),
      "Invalid cage status",
    );
    await this.db.transaction(async () => {
      const now = stamp();
      if (cageId)
        await this.db.execute(
          "UPDATE cages SET cage_number=?,name=?,hen_count=?,status=?,notes=?,updated_at=? WHERE id=?",
          [
            input.cage_number,
            input.name,
            input.hen_count,
            input.status,
            input.notes,
            now,
            cageId,
          ],
        );
      else {
        const [farm] = await this.db.query("SELECT id FROM farms");
        assert(farm, "Set up a farm first");
        await insert(this.db, "cages", {
          id: id(),
          farm_id: farm.id,
          ...input,
          created_at: now,
          updated_at: now,
        });
      }
    });
  }
  async settings(name: string, owner: string, prices: Record<string, number>) {
    text.parse(name);
    await this.db.transaction(async () => {
      for (const s of await this.db.query<{ id: string }>(
        "SELECT id FROM egg_inventory",
      ))
        integer.parse(prices[s.id]);
      await this.db.execute("UPDATE farms SET name=?,owner=?,updated_at=?", [
        name,
        owner,
        stamp(),
      ]);
      await this.db.execute(
        "UPDATE settings SET value=?,updated_at=? WHERE id=?",
        [JSON.stringify(prices), stamp(), "prices"],
      );
    });
  }
}
