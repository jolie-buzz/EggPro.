import { auditEggTimeline } from "./egg-ledger";
import { Capacitor } from "@capacitor/core";
import { Database, type Row } from "../database/database";
import { tables, migrations, type Table } from "../database/migrations";
import { rowSchemas } from "./backup-schema";
import { assert } from "./validation";
import { insert, id, stamp } from "../repositories/farm";
import { sizes, losses, weightedCost, today } from "../utils/calculations";
import type {
  Feed,
  Purchase,
  Usage,
  Sale,
  SaleItem,
  Payment,
  Expense,
  Stock,
  Sorting,
} from "../types/models";
export type Backup = {
  format: "FarmTrack";
  version: 1;
  schemaVersion: number;
  exportedAt: string;
  data: Record<Table, Row[]>;
  checksum: string;
};
const schemaVersion = migrations.at(-1)!.version;
export async function checksum(data: unknown) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function validateBackup(input: string): Promise<Backup> {
  assert(
    input.length <= 25 * 1024 * 1024,
    "Backup is too large (maximum 25 MB).",
  );
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  assert(value && typeof value === "object", "Invalid FarmTrack backup");
  const b = value as Backup;
  assert(
    b.format === "FarmTrack" &&
      b.version === 1 &&
      Number.isInteger(b.schemaVersion) &&
      b.schemaVersion >= 1 &&
      b.schemaVersion <= schemaVersion,
    "This is not a supported FarmTrack backup version.",
  );
  assert(b.data && typeof b.data === "object", "Missing backup data");
  assert(
    Object.keys(b.data).length === tables.length &&
      tables.every((t) => Array.isArray(b.data[t])),
    "Backup is missing required tables.",
  );
  assert(
    typeof b.exportedAt === "string" && !Number.isNaN(Date.parse(b.exportedAt)),
    "Invalid export date",
  );
  assert(
    b.checksum === (await checksum(b.data)),
    "Backup checksum does not match. The file may be damaged.",
  );
  for (const t of tables) {
    assert(b.data[t].length <= 200000, "Too many records in backup.");
    for (const row of b.data[t]) rowSchemas[t].parse(row);
  }
  assert(b.data.farms.length === 1, "Backup must contain exactly one farm");
  assert(b.data.settings.length === 2, "Invalid farm settings");
  const currency = b.data.settings.find((r) => r.id === "currency")?.value;
  assert(
    typeof currency === "string" &&
      ["PHP", "USD", "EUR", "GBP", "AUD"].includes(currency),
    "Invalid currency",
  );
  const prices = JSON.parse(
    String(b.data.settings.find((r) => r.id === "prices")?.value),
  );
  assert(
    b.data.egg_inventory.every(
      (s) =>
        Object.hasOwn(prices, String(s.id)) &&
        Number.isSafeInteger(prices[String(s.id)]) &&
        prices[String(s.id)] >= 0,
    ),
    "Invalid default prices",
  );
  return b;
}
export class BackupService {
  constructor(private db: Database) {}
  async export(): Promise<Backup> {
    return this.db.transaction(async () => {
      await insert(this.db, "backup_metadata", {
        id: id(),
        date: stamp(),
        schema_version: schemaVersion,
        created_at: stamp(),
      });
      const data = {} as Record<Table, Row[]>;
      for (const t of tables)
        data[t] = await this.db.query(`SELECT * FROM ${t} ORDER BY id`);
      return {
        format: "FarmTrack",
        version: 1,
        schemaVersion,
        exportedAt: stamp(),
        data,
        checksum: await checksum(data),
      };
    });
  }
  async import(text: string) {
    const backup = await validateBackup(text);
    await this.db.transaction(async () => {
      for (const t of [...tables].reverse())
        await this.db.execute(`DELETE FROM ${t}`);
      for (const t of tables)
        for (const row of backup.data[t]) await insert(this.db, t, row);
      const foreignKeys = await this.db.query("PRAGMA foreign_key_check");
      assert(foreignKeys.length === 0, "Backup has broken record references");
      await this.audit();
    });
  }
  private async audit() {
    await auditEggTimeline(this.db);
    const sales = await this.db.query<Sale>("SELECT * FROM sales"),
      items = await this.db.query<SaleItem>("SELECT * FROM sale_items"),
      payments = await this.db.query<Payment>("SELECT * FROM payments"),
      stock = await this.db.query<Stock>("SELECT * FROM egg_inventory"),
      sorting = await this.db.query<Sorting>("SELECT * FROM egg_sorting");
    assert(
      sizes.every((s) => stock.some((r) => r.id === s)),
      "Backup is missing egg inventory sizes",
    );
    assert(
      sorting.every(
        (r) =>
          stock.some((s) => s.id === r.size) ||
          losses.some((s) => s === r.size),
      ),
      "Backup contains an unknown sorting size",
    );
    for (const i of items) {
      assert(
        Math.abs(i.quantity * (i.unit === "Tray" ? 30 : 1) - i.eggs) <
          0.000001 && i.total === Math.round(i.price_snapshot * i.quantity),
        "Invalid sale line totals",
      );
    }
    for (const s of sales) {
      const lines = items.filter((i) => i.sale_id === s.id),
        paid = payments
          .filter((p) => p.sale_id === s.id)
          .reduce((n, p) => n + p.amount, 0);
      assert(
        lines.length > 0 &&
          lines.reduce((n, i) => n + i.total, 0) === s.subtotal &&
          s.total === s.subtotal - s.discount &&
          paid <= s.total,
        "Invalid sale or payment totals",
      );
      assert(
        s.customer_id || paid === s.total,
        "Unpaid walk-in sale in backup",
      );
      for (const p of payments.filter((p) => p.sale_id === s.id))
        assert(p.date >= s.date, "Payment predates sale");
    }
    for (const r of stock)
      assert(
        r.quantity ===
          sorting
            .filter((s) => s.size === r.id)
            .reduce((n, s) => n + s.quantity, 0) -
            items
              .filter((i) => i.size === r.id)
              .reduce((n, i) => n + i.eggs, 0),
        "Egg inventory does not match sorting and sales",
      );
    const feeds = await this.db.query<Feed>("SELECT * FROM feed_items"),
      purchases = await this.db.query<Purchase>("SELECT * FROM feed_purchases"),
      uses = await this.db.query<Usage>("SELECT * FROM feed_usage"),
      expenses = await this.db.query<Expense>("SELECT * FROM expenses");
    for (const p of purchases) {
      const matched = expenses.filter((e) => e.feed_purchase_id === p.id);
      assert(
        p.total_cost === Math.round(p.sacks * p.cost_per_sack) &&
          matched.length === 1 &&
          matched[0].category === "Feed" &&
          matched[0].amount === p.total_cost &&
          matched[0].date === p.date,
        "Feed expense does not match purchase",
      );
    }
    for (const e of expenses)
      assert(
        e.category !== "Feed" || e.feed_purchase_id,
        "Unlinked feed expense",
      );
    for (const f of feeds) {
      const events = [
        ...purchases
          .filter((p) => p.feed_id === f.id)
          .map((p) => ({
            date: p.date,
            kind: 0,
            created: p.created_at,
            p,
            u: null,
          })),
        ...uses
          .filter((u) => u.feed_id === f.id)
          .map((u) => ({
            date: u.date,
            kind: 1,
            created: u.created_at,
            p: null,
            u,
          })),
      ].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.kind - b.kind ||
          a.created.localeCompare(b.created),
      );
      let kg = 0,
        cost = 0;
      for (const e of events) {
        if (e.p) {
          const add = e.p.sacks * e.p.sack_weight_kg;
          cost = weightedCost(kg, cost, add, e.p.total_cost);
          kg += add;
        } else if (e.u) {
          assert(
            kg + 0.000001 >= e.u.quantity_kg &&
              Math.abs(e.u.cost_per_kg_snapshot - cost) < 0.001 &&
              e.u.total_cost === Math.round(e.u.quantity_kg * cost),
            "Feed consumption ledger is inconsistent",
          );
          kg = Math.max(0, kg - e.u.quantity_kg);
        }
      }
      assert(
        Math.abs(f.quantity_kg - kg) < 0.000001 &&
          Math.abs(f.average_cost - cost) < 0.001,
        "Feed stock does not match its ledger",
      );
    }
  }
}
export async function shareBackup(backup: Backup) {
  const name = `farmtrack-backup-${today()}.json`,
    data = JSON.stringify(backup, null, 2);
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const file = await Filesystem.writeFile({
      path: name,
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "FarmTrack backup",
      url: file.uri,
      dialogTitle: "Save or share your farm backup",
    });
  } else {
    const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
