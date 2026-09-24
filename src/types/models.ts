export type Size = string;
export type Category = string;
export interface Farm {
  id: string;
  name: string;
  owner: string;
  created_at: string;
  updated_at: string;
}
export interface Cage {
  id: string;
  farm_id: string;
  cage_number: string;
  name: string;
  hen_count: number;
  status: "active" | "inactive";
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface Production {
  id: string;
  date: string;
  cage_id: string;
  hen_count_snapshot: number;
  egg_count: number;
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface Sorting {
  id: string;
  date: string;
  size: Category;
  quantity: number;
  created_at: string;
  updated_at: string;
}
export interface Stock {
  id: Size;
  quantity: number;
  updated_at: string;
}
export interface Feed {
  id: string;
  name: string;
  brand: string;
  sack_weight_kg: number;
  cost_per_sack: number;
  quantity_kg: number;
  average_cost: number;
  reorder_level_kg: number;
  created_at: string;
  updated_at: string;
}
export interface Purchase {
  id: string;
  feed_id: string;
  date: string;
  supplier: string;
  sacks: number;
  sack_weight_kg: number;
  cost_per_sack: number;
  total_cost: number;
  created_at: string;
}
export interface Usage {
  id: string;
  feed_id: string;
  date: string;
  quantity_kg: number;
  cost_per_kg_snapshot: number;
  total_cost: number;
  notes: string;
  created_at: string;
}
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface Sale {
  id: string;
  customer_id: string | null;
  date: string;
  subtotal: number;
  discount: number;
  total: number;
  notes: string;
  created_at: string;
}
export interface SaleItem {
  id: string;
  sale_id: string;
  size: Size;
  quantity: number;
  unit: "Egg" | "Tray";
  eggs: number;
  price_snapshot: number;
  total: number;
}
export interface Payment {
  id: string;
  sale_id: string;
  date: string;
  amount: number;
  method: string;
  notes: string;
  created_at: string;
}
export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  supplier: string;
  notes: string;
  feed_purchase_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface Alert {
  id: string;
  cage_id: string;
  date: string;
  message: string;
  created_at: string;
}
export interface State {
  farms: Farm[];
  settings: Record<string, string>;
  cages: Cage[];
  daily_production: Production[];
  egg_sorting: Sorting[];
  egg_inventory: Stock[];
  feed_items: Feed[];
  feed_purchases: Purchase[];
  feed_usage: Usage[];
  customers: Customer[];
  sales: Sale[];
  sale_items: SaleItem[];
  payments: Payment[];
  expenses: Expense[];
  alerts: Alert[];
}
