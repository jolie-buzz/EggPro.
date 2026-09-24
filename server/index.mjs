import { Pool } from "pg";
import { createApp, initialize } from "./app.mjs";
if (!process.env.DATABASE_URL)
  throw new Error(
    "Set DATABASE_URL to the private Neon connection string in the Render server environment.",
  );
const url = new URL(process.env.DATABASE_URL);
// Validate server certificates even when a supplied connection string says require.
url.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: true },
  max: 5,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  enableChannelBinding: true,
});
pool.on("error", () =>
  console.error(
    "Database connection interrupted; retrying on the next request.",
  ),
);
await initialize(pool);
const origins = (
  process.env.ALLOWED_ORIGINS ??
  "https://localhost,http://localhost,capacitor://localhost"
)
  .split(",")
  .map((s) => s.trim());
const app = createApp(pool, {
  allowedOrigins: origins,
  trustProxy: process.env.RENDER === "true" ? 1 : false,
});
const server = app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log("EggPro server ready"),
);
// Bound the durable rate-limit/session tables without touching farm records.
const maintenance = setInterval(
  () => {
    void pool
      .query("DELETE FROM eggpro.rate_limits WHERE reset_at<now()")
      .catch(() => {});
    void pool
      .query("DELETE FROM eggpro.sessions WHERE expires_at<now()")
      .catch(() => {});
  },
  15 * 60 * 1000,
);
maintenance.unref();
process.on("SIGTERM", () => {
  clearInterval(maintenance);
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
});
