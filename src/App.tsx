import { useEffect, useState } from "react";
import {
  Home as HomeIcon,
  Egg,
  Package,
  Receipt,
  Menu,
  Sprout,
  ChevronRight,
  Grid2X2,
  Users,
  Wallet,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  ShieldCheck,
  Leaf,
  FlaskConical,
  BookOpen,
} from "lucide-react";
import { openDatabase } from "./database/open";
import type { Database } from "./database/database";
import { FarmRepository } from "./repositories/farm";
import { ProductionRepository } from "./repositories/production";
import { InventoryRepository } from "./repositories/inventory";
import { SalesRepository } from "./repositories/sales";
import { ExpenseRepository } from "./repositories/expenses";
import type { State } from "./types/models";
import { Setup } from "./pages/Setup";
import { Cages } from "./pages/Cages";
import { Home } from "./pages/Home";
import { Production } from "./pages/Production";
import { Inventory, Sorting, Feed } from "./pages/Inventory";
import { Sales } from "./pages/Sales";
import { Customers, Receivables } from "./pages/Customers";
import { Expenses } from "./pages/Expenses";
import { Financial, Reports } from "./pages/Reports";
import { Settings, Backup, Demo } from "./pages/Settings";
import { Card, Heading, errorMessage } from "./components/ui";
const tabs = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "production", label: "Production", icon: Egg },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "sales", label: "Sales", icon: Receipt },
  { id: "more", label: "More", icon: Menu },
];
const more = [
  {
    id: "cages",
    title: "Cage management",
    detail: "Your flock, cage by cage",
    icon: Grid2X2,
  },
  {
    id: "customers",
    title: "Customers",
    detail: "Profiles and purchase history",
    icon: Users,
  },
  {
    id: "receivables",
    title: "Receivables",
    detail: "Collect outstanding balances",
    icon: Wallet,
  },
  {
    id: "expenses",
    title: "Expenses",
    detail: "Track where your money goes",
    icon: Receipt,
  },
  {
    id: "financial",
    title: "Farm finances",
    detail: "Cash flow and estimated profit",
    icon: ChartNoAxesCombined,
  },
  {
    id: "reports",
    title: "Reports & cage rankings",
    detail: "Explore production and performance",
    icon: BookOpen,
  },
  {
    id: "feed",
    title: "Feed management",
    detail: "Purchases and daily consumption",
    icon: Leaf,
  },
  {
    id: "settings",
    title: "Farm settings",
    detail: "Farm details and egg prices",
    icon: SettingsIcon,
  },
  {
    id: "backup",
    title: "Backup & restore",
    detail: "Keep your farm records safe",
    icon: ShieldCheck,
  },
  {
    id: "demo",
    title: "Sample data",
    detail: "Optional records for a new farm",
    icon: FlaskConical,
  },
];
export function App() {
  const [db, setDb] = useState<Database>(),
    [state, setState] = useState<State>(),
    [page, setPage] = useState("home"),
    [error, setError] = useState("");
  useEffect(() => {
    openDatabase()
      .then(async (d) => {
        setDb(d);
        setState(await new FarmRepository(d).snapshot());
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  async function refresh() {
    if (db) setState(await new FarmRepository(db).snapshot());
  }
  function go(p: string) {
    setPage(p);
    window.scrollTo({ top: 0 });
  }
  if (error)
    return (
      <main className="setup">
        <h1>FarmTrack couldn’t open your data</h1>
        <p className="error" role="alert">
          {error}
        </p>
        <p>
          Your existing database has not been deliberately reset. Try reopening
          the app.
        </p>
        <button onClick={() => location.reload()}>Try again</button>
      </main>
    );
  if (!db || !state)
    return (
      <main className="loading">
        <Sprout size={40} />
        <h1>FarmTrack</h1>
        <p>Opening your local farm…</p>
      </main>
    );
  const farm = new FarmRepository(db),
    production = new ProductionRepository(db),
    inventory = new InventoryRepository(db),
    sales = new SalesRepository(db),
    expenses = new ExpenseRepository(db);
  if (!state.farms.length) return <Setup farm={farm} done={refresh} />;
  const common = { state, refresh };
  const back = () => go("more");
  let content;
  switch (page) {
    case "home":
      content = <Home state={state} go={go} />;
      break;
    case "production":
      content = <Production {...common} repo={production} />;
      break;
    case "inventory":
      content = <Inventory state={state} go={go} />;
      break;
    case "sorting":
      content = (
        <Sorting {...common} repo={inventory} back={() => go("inventory")} />
      );
      break;
    case "feed":
      content = (
        <Feed {...common} repo={inventory} back={() => go("inventory")} />
      );
      break;
    case "sales":
      content = <Sales {...common} repo={sales} go={go} />;
      break;
    case "customers":
      content = <Customers {...common} repo={sales} back={back} />;
      break;
    case "receivables":
      content = <Receivables {...common} repo={sales} back={back} />;
      break;
    case "expenses":
      content = <Expenses {...common} repo={expenses} back={back} go={go} />;
      break;
    case "financial":
      content = <Financial state={state} back={back} />;
      break;
    case "reports":
      content = <Reports state={state} back={back} />;
      break;
    case "cages":
      content = <Cages {...common} farm={farm} back={back} />;
      break;
    case "settings":
      content = <Settings {...common} farm={farm} back={back} />;
      break;
    case "backup":
      content = <Backup db={db} refresh={refresh} back={back} />;
      break;
    case "demo":
      content = <Demo db={db} refresh={refresh} back={back} />;
      break;
    default:
      content = (
        <>
          <Heading
            title="A place for everything"
            subtitle="Manage the details that keep your farm growing."
          />
          <Card className="more-menu">
            {more.map((m) => (
              <button
                className="list-row row-button"
                key={m.id}
                onClick={() => go(m.id)}
              >
                <m.icon size={22} />
                <div>
                  <strong>{m.title}</strong>
                  <small>{m.detail}</small>
                </div>
                <ChevronRight size={18} />
              </button>
            ))}
          </Card>
          <p className="privacy">
            <ShieldCheck size={16} /> FarmTrack 1.0 · Offline, on your device
          </p>
        </>
      );
  }
  const active = ["sorting", "feed"].includes(page)
    ? "inventory"
    : ["customers", "receivables"].includes(page)
      ? "sales"
      : tabs.some((t) => t.id === page)
        ? page
        : "more";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Sprout size={30} /> FarmTrack
        </div>
        <p className="sidebar-farm">{state.farms[0].name}</p>
        <nav aria-label="Desktop navigation">
          {tabs.map((t) => (
            <button
              className={active === t.id ? "selected" : ""}
              key={t.id}
              onClick={() => go(t.id)}
            >
              <t.icon size={21} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <ShieldCheck size={18} />
          <div>
            <strong>Yours. Always.</strong>
            <small>Stored locally · works offline</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="brand">
            <Sprout size={24} />
            <span>FarmTrack</span>
          </div>
          <span className="farm-name">{state.farms[0].name}</span>
          <span className="offline-dot">On device</span>
        </header>
        <main className="content" key={page}>
          {content}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-current={active === t.id ? "page" : undefined}
            className={active === t.id ? "selected" : ""}
            onClick={() => go(t.id)}
          >
            <t.icon size={22} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
