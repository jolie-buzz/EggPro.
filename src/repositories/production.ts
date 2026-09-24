import { Database } from "../database/database";
import type { Cage, Production } from "../types/models";
import { assert, dateSchema, integer, note } from "../services/validation";
import { id, stamp, insert } from "./farm";
import { rate, shiftDate } from "../utils/calculations";
export class ProductionRepository {
  constructor(private db: Database) {}
  private async write(
    date: string,
    cageId: string,
    eggs: number,
    notes: string,
  ) {
    dateSchema.parse(date);
    integer.parse(eggs);
    note.parse(notes);
    const [c] = await this.db.query<Cage>("SELECT * FROM cages WHERE id=?", [
      cageId,
    ]);
    assert(c, "Cage not found");
    const [old] = await this.db.query<Production>(
      "SELECT * FROM daily_production WHERE date=? AND cage_id=?",
      [date, cageId],
    );
    assert(
      c.status === "active" || old,
      "Cannot create a record for an inactive cage",
    );
    const now = stamp();
    if (old)
      await this.db.execute(
        "UPDATE daily_production SET egg_count=?,notes=?,updated_at=? WHERE id=?",
        [eggs, notes, now, old.id],
      );
    else
      await insert(this.db, "daily_production", {
        id: id(),
        date,
        cage_id: cageId,
        egg_count: eggs,
        hen_count_snapshot: c.hen_count,
        notes,
        created_at: now,
        updated_at: now,
      });
    await this.alert(cageId);
  }
  private async alert(cageId: string) {
    const records = await this.db.query<Production>(
      "SELECT * FROM daily_production WHERE cage_id=? ORDER BY date DESC LIMIT 3",
      [cageId],
    );
    await this.db.execute("DELETE FROM alerts WHERE cage_id=?", [cageId]);
    if (
      records.length === 3 &&
      records.every(
        (r) =>
          r.hen_count_snapshot > 0 &&
          rate(r.egg_count, r.hen_count_snapshot) < 50,
      )
    ) {
      const [c] = await this.db.query<Cage>("SELECT * FROM cages WHERE id=?", [
        cageId,
      ]);
      await insert(this.db, "alerts", {
        id: id(),
        cage_id: cageId,
        date: records[0].date,
        message: `Cage ${c.cage_number} has produced below 50% for 3 consecutive recorded days.`,
        created_at: stamp(),
      });
    }
  }
  save(date: string, cageId: string, eggs: number, notes = "") {
    return this.db.transaction(() => this.write(date, cageId, eggs, notes));
  }
  bulk(date: string, mode: "zero" | "yesterday" | "clear") {
    dateSchema.parse(date);
    return this.db.transaction(async () => {
      const cages = await this.db.query<Cage>(
        "SELECT * FROM cages WHERE status='active'",
      );
      if (mode === "clear") {
        await this.db.execute("DELETE FROM daily_production WHERE date=?", [
          date,
        ]);
        for (const c of await this.db.query<Cage>("SELECT * FROM cages"))
          await this.alert(c.id);
      } else
        for (const c of cages) {
          let eggs = 0;
          if (mode === "yesterday") {
            const [r] = await this.db.query<Production>(
              "SELECT * FROM daily_production WHERE date=? AND cage_id=?",
              [shiftDate(date, -1), c.id],
            );
            if (!r) continue;
            eggs = r.egg_count;
          }
          await this.write(date, c.id, eggs, "");
        }
    });
  }
}
