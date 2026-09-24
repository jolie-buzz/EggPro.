import { Database } from "../database/database";
import {
  dateSchema,
  text,
  integer,
  assert,
  note,
} from "../services/validation";
import { expenseCategories } from "../utils/calculations";
import { insert, id, stamp } from "./farm";
import type { Expense } from "../types/models";
export class ExpenseRepository {
  constructor(private db: Database) {}
  async save(
    input: {
      date: string;
      category: string;
      description: string;
      amount: number;
      supplier: string;
      notes: string;
    },
    expenseId?: string,
  ) {
    dateSchema.parse(input.date);
    text.parse(input.description);
    integer.parse(input.amount);
    note.parse(input.notes);
    assert(
      expenseCategories.includes(
        input.category as (typeof expenseCategories)[number],
      ),
      "Choose a valid category",
    );
    assert(
      input.category !== "Feed",
      "Record feed purchases in Feed management so stock and expense stay matched.",
    );
    await this.db.transaction(async () => {
      if (expenseId) {
        const [old] = await this.db.query<Expense>(
          "SELECT * FROM expenses WHERE id=?",
          [expenseId],
        );
        assert(
          old && !old.feed_purchase_id,
          "Feed expenses are maintained by the feed purchase ledger.",
        );
        await this.db.execute(
          "UPDATE expenses SET date=?,category=?,description=?,amount=?,supplier=?,notes=?,updated_at=? WHERE id=?",
          [
            input.date,
            input.category,
            input.description,
            input.amount,
            input.supplier,
            input.notes,
            stamp(),
            expenseId,
          ],
        );
      } else
        await insert(this.db, "expenses", {
          id: id(),
          ...input,
          feed_purchase_id: null,
          created_at: stamp(),
          updated_at: stamp(),
        });
    });
  }
}
