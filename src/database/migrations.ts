// Append-only migrations. All money is integer minor units; quantities are eggs or kg.
export const migrations = [
  {
    version: 1,
    sql: `
CREATE TABLE farms (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE settings (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE cages (id TEXT PRIMARY KEY, farm_id TEXT NOT NULL REFERENCES farms(id), cage_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', hen_count INTEGER NOT NULL CHECK(hen_count >= 0), status TEXT NOT NULL CHECK(status IN ('active','inactive')), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE daily_production (id TEXT PRIMARY KEY, date TEXT NOT NULL, cage_id TEXT NOT NULL REFERENCES cages(id), hen_count_snapshot INTEGER NOT NULL CHECK(hen_count_snapshot >= 0), egg_count INTEGER NOT NULL CHECK(egg_count >= 0), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(date,cage_id));
CREATE TABLE egg_sorting (id TEXT PRIMARY KEY, date TEXT NOT NULL, size TEXT NOT NULL CHECK(size IN ('Small','Medium','Large','XL','Cracked','Damaged','Dirty')), quantity INTEGER NOT NULL CHECK(quantity >= 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(date,size));
CREATE TABLE egg_inventory (id TEXT PRIMARY KEY CHECK(id IN ('Small','Medium','Large','XL')), quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0), updated_at TEXT NOT NULL);
CREATE TABLE feed_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '', sack_weight_kg REAL NOT NULL CHECK(sack_weight_kg > 0), cost_per_sack INTEGER NOT NULL CHECK(cost_per_sack >= 0), quantity_kg REAL NOT NULL DEFAULT 0 CHECK(quantity_kg >= 0), average_cost REAL NOT NULL DEFAULT 0 CHECK(average_cost >= 0), reorder_level_kg REAL NOT NULL DEFAULT 50 CHECK(reorder_level_kg >= 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE feed_purchases (id TEXT PRIMARY KEY, feed_id TEXT NOT NULL REFERENCES feed_items(id), date TEXT NOT NULL, supplier TEXT NOT NULL DEFAULT '', sacks REAL NOT NULL CHECK(sacks > 0), sack_weight_kg REAL NOT NULL CHECK(sack_weight_kg > 0), cost_per_sack INTEGER NOT NULL CHECK(cost_per_sack >= 0), total_cost INTEGER NOT NULL CHECK(total_cost >= 0), created_at TEXT NOT NULL);
CREATE TABLE feed_usage (id TEXT PRIMARY KEY, feed_id TEXT NOT NULL REFERENCES feed_items(id), date TEXT NOT NULL, quantity_kg REAL NOT NULL CHECK(quantity_kg > 0), cost_per_kg_snapshot REAL NOT NULL CHECK(cost_per_kg_snapshot >= 0), total_cost INTEGER NOT NULL CHECK(total_cost >= 0), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE sales (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id), date TEXT NOT NULL, subtotal INTEGER NOT NULL CHECK(subtotal >= 0), discount INTEGER NOT NULL CHECK(discount >= 0 AND discount <= subtotal), total INTEGER NOT NULL CHECK(total = subtotal-discount), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE sale_items (id TEXT PRIMARY KEY, sale_id TEXT NOT NULL REFERENCES sales(id), size TEXT NOT NULL REFERENCES egg_inventory(id), quantity REAL NOT NULL CHECK(quantity > 0), unit TEXT NOT NULL CHECK(unit IN ('Egg','Tray')), eggs INTEGER NOT NULL CHECK(eggs > 0), price_snapshot INTEGER NOT NULL CHECK(price_snapshot >= 0), total INTEGER NOT NULL CHECK(total >= 0));
CREATE TABLE payments (id TEXT PRIMARY KEY, sale_id TEXT NOT NULL REFERENCES sales(id), date TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), method TEXT NOT NULL CHECK(method IN ('Cash','GCash','Bank Transfer')), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE expenses (id TEXT PRIMARY KEY, date TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 0), supplier TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', feed_purchase_id TEXT UNIQUE REFERENCES feed_purchases(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE alerts (id TEXT PRIMARY KEY, cage_id TEXT NOT NULL REFERENCES cages(id), date TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE backup_metadata (id TEXT PRIMARY KEY, date TEXT NOT NULL, schema_version INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX production_date ON daily_production(date);
CREATE INDEX sales_date ON sales(date);
CREATE INDEX payments_sale ON payments(sale_id);
CREATE INDEX feed_usage_date ON feed_usage(date);
CREATE INDEX expenses_date ON expenses(date);
`,
  },
  {
    version: 2,
    rebuildsReferencedTables: true,
    sql: `
CREATE TABLE egg_inventory_new (id TEXT PRIMARY KEY COLLATE NOCASE CHECK(length(trim(id)) BETWEEN 1 AND 40 AND id = trim(id) AND lower(id) NOT IN ('cracked','damaged','dirty','__proto__','constructor','prototype')), quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0), updated_at TEXT NOT NULL);
INSERT INTO egg_inventory_new SELECT * FROM egg_inventory;
DROP TABLE egg_inventory;
ALTER TABLE egg_inventory_new RENAME TO egg_inventory;
CREATE TABLE egg_sorting_new (id TEXT PRIMARY KEY, date TEXT NOT NULL, size TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity >= 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(date,size));
INSERT INTO egg_sorting_new SELECT * FROM egg_sorting;
DROP TABLE egg_sorting;
ALTER TABLE egg_sorting_new RENAME TO egg_sorting;
`,
  },
];
export const tables = [
  "farms",
  "settings",
  "cages",
  "daily_production",
  "egg_sorting",
  "egg_inventory",
  "feed_items",
  "feed_purchases",
  "feed_usage",
  "customers",
  "sales",
  "sale_items",
  "payments",
  "expenses",
  "alerts",
  "backup_metadata",
] as const;
export type Table = (typeof tables)[number];
