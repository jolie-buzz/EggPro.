import express from "express";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as derive,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const scrypt = promisify(derive),
  hash = (value) => createHash("sha256").update(value).digest("hex");
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: u.created_at,
});
const fail = (status, message) => Object.assign(new Error(message), { status });
async function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${key.toString("hex")}`;
}
async function passwordMatches(password, saved) {
  const next = await passwordHash(password, saved.split(":")[0]);
  const a = Buffer.from(next),
    b = Buffer.from(saved);
  return a.length === b.length && timingSafeEqual(a, b);
}
const dummyHash = await passwordHash("dummy-account-password");
export async function initialize(db) {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(734926182)");
    await c.query(
      await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export function createApp(
  db,
  { dist = resolve("dist"), allowedOrigins = [], trustProxy = false } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
    });
    if (req.path.startsWith("/api/")) {
      res.set("Cache-Control", "no-store");
      const origin = req.get("origin");
      if (origin && allowedOrigins.includes(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
        res.vary("Origin");
        res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        res.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
      }
      if (req.method === "OPTIONS") return res.sendStatus(204);
    }
    next();
  });
  app.use("/api", express.json({ limit: "11mb" }));
  async function rateLimit(req, kind, max = 20) {
    const key = hash(`${kind}:${req.ip}`);
    const { rows } = await db.query(
      `INSERT INTO eggpro.rate_limits(key,count,reset_at) VALUES($1,1,now()+interval '15 minutes')
   ON CONFLICT(key) DO UPDATE SET count=CASE WHEN eggpro.rate_limits.reset_at < now() THEN 1 ELSE eggpro.rate_limits.count+1 END,
   reset_at=CASE WHEN eggpro.rate_limits.reset_at < now() THEN now()+interval '15 minutes' ELSE eggpro.rate_limits.reset_at END RETURNING count`,
      [key],
    );
    if (rows[0].count > max)
      throw fail(429, "Too many attempts. Please wait 15 minutes.");
  }
  async function session(c, u) {
    const token = randomBytes(32).toString("base64url");
    const expires = Math.floor(Date.now() / 1000) + 90 * 86400;
    await c.query(
      "INSERT INTO eggpro.sessions(token_hash,user_id,expires_at) VALUES($1,$2,to_timestamp($3))",
      [hash(token), u.id, expires],
    );
    return {
      access_token: token,
      refresh_token: "",
      token_type: "bearer",
      expires_in: 90 * 86400,
      expires_at: expires,
      user: publicUser(u),
    };
  }
  async function auth(req, res, next) {
    try {
      const token = req
        .get("authorization")
        ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      if (!token)
        throw fail(
          401,
          "Sign in online again to sync. Saved phone records are kept.",
        );
      const { rows } = await db.query(
        `SELECT u.* FROM eggpro.sessions s JOIN eggpro.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
        [hash(token)],
      );
      if (!rows[0])
        throw fail(
          401,
          "Session expired. Sign in online again to sync. Saved phone records are kept.",
        );
      req.user = rows[0];
      req.tokenHash = hash(token);
      await db.query(
        "UPDATE eggpro.sessions SET expires_at=now()+interval '90 days' WHERE token_hash=$1",
        [req.tokenHash],
      );
      next();
    } catch (e) {
      next(e);
    }
  }
  function credentials(body) {
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (
      email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      password.length < 8 ||
      password.length > 128
    )
      throw fail(
        400,
        "Enter a valid email and a password with 8–128 characters.",
      );
    return { email, password };
  }
  app.get("/api/health", async (req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ ok: true, backend: "neon", version: "3.1.0" });
    } catch {
      res.status(503).json({ error: "Database unavailable" });
    }
  });
  app.post("/api/auth/signup", async (req, res) => {
    await rateLimit(req, "signup", 10);
    const { email, password } = credentials(req.body);
    const encrypted = await passwordHash(password),
      recovery = randomBytes(24).toString("base64url");
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      const { rows } = await c.query(
        "INSERT INTO eggpro.users(id,email,password_hash,recovery_hash) VALUES($1,$2,$3,$4) RETURNING *",
        [randomUUID(), email, encrypted, hash(recovery)],
      );
      const data = await session(c, rows[0]);
      await c.query("COMMIT");
      res.status(201).json({ session: data, recoveryCode: recovery });
    } catch (e) {
      await c.query("ROLLBACK");
      if (e.code === "23505")
        throw fail(
          409,
          "Could not create this account. Try signing in or recovering it.",
        );
      throw e;
    } finally {
      c.release();
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    await rateLimit(req, "login");
    const { email, password } = credentials(req.body);
    const { rows } = await db.query(
      "SELECT * FROM eggpro.users WHERE email=$1",
      [email],
    );
    if (
      !(await passwordMatches(password, rows[0]?.password_hash ?? dummyHash)) ||
      !rows[0]
    )
      throw fail(401, "Email or password is incorrect.");
    res.json({ session: await session(db, rows[0]) });
  });
  app.post("/api/auth/recover", async (req, res) => {
    await rateLimit(req, "recover", 10);
    const { email, password } = credentials(req.body);
    const code =
      typeof req.body.recoveryCode === "string" ? req.body.recoveryCode : "";
    if (code.length !== 32)
      throw fail(
        400,
        "Enter the recovery key saved when you created your account.",
      );
    const encrypted = await passwordHash(password),
      recovery = randomBytes(24).toString("base64url");
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      const { rows } = await c.query(
        "UPDATE eggpro.users SET password_hash=$1,recovery_hash=$2 WHERE email=$3 AND recovery_hash=$4 RETURNING *",
        [encrypted, hash(recovery), email, hash(code)],
      );
      if (!rows[0]) throw fail(401, "Email or recovery key is incorrect.");
      await c.query("DELETE FROM eggpro.sessions WHERE user_id=$1", [
        rows[0].id,
      ]);
      const data = await session(c, rows[0]);
      await c.query("COMMIT");
      res.json({ session: data, recoveryCode: recovery });
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  });
  app.get("/api/auth/session", auth, (req, res) =>
    res.json({ user: publicUser(req.user) }),
  );
  app.post("/api/auth/logout", auth, async (req, res) => {
    await db.query("DELETE FROM eggpro.sessions WHERE token_hash=$1", [
      req.tokenHash,
    ]);
    res.json({ ok: true });
  });
  app.get("/api/farm", auth, async (req, res) => {
    const { rows } = await db.query(
      "SELECT revision,document,mutation_id,updated_at FROM eggpro.farms WHERE owner_id=$1",
      [req.user.id],
    );
    res.json(
      rows[0] ? { ...rows[0], revision: Number(rows[0].revision) } : null,
    );
  });
  app.put("/api/farm", auth, async (req, res) => {
    await rateLimit(req, "save", 600);
    const { document, revision, mutationId } = req.body ?? {};
    if (
      !Number.isSafeInteger(revision) ||
      revision < 0 ||
      !uuid.test(mutationId ?? "") ||
      !document ||
      document.format !== "FarmTrack" ||
      document.version !== 1 ||
      document.schemaVersion !== 2 ||
      !Array.isArray(document.data?.farms) ||
      document.data.farms.length !== 1 ||
      Buffer.byteLength(JSON.stringify(document), "utf8") > 10000000
    )
      throw fail(400, "Invalid farm backup. Your phone records were kept.");
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        req.user.id,
      ]);
      const current = (
        await c.query("SELECT * FROM eggpro.farms WHERE owner_id=$1", [
          req.user.id,
        ])
      ).rows[0];
      if (current?.mutation_id === mutationId) {
        await c.query("COMMIT");
        return res.json({
          revision: Number(current.revision),
          mutation_id: current.mutation_id,
          updated_at: current.updated_at,
        });
      }
      if (Number(current?.revision ?? 0) !== revision)
        throw fail(
          409,
          "Another phone updated this farm. Sync again to review both versions.",
        );
      const { rows } = await c.query(
        `INSERT INTO eggpro.farms(owner_id,revision,document,mutation_id) VALUES($1,$2,$3,$4)
    ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision,document=excluded.document,mutation_id=excluded.mutation_id,updated_at=now()
    RETURNING revision,mutation_id,updated_at`,
        [req.user.id, revision + 1, JSON.stringify(document), mutationId],
      );
      await c.query("COMMIT");
      res.json({ ...rows[0], revision: Number(rows[0].revision) });
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found" }),
  );
  app.use(
    express.static(dist, {
      index: false,
      setHeaders(res, file) {
        if (
          file.endsWith("/sw.js") ||
          file.endsWith("/index.html") ||
          file.endsWith(".webmanifest")
        )
          res.set("Cache-Control", "no-cache");
      },
    }),
  );
  app.get("/{*path}", (req, res) => {
    if (req.path.includes(".") && req.path !== "/index.html")
      return res.sendStatus(404);
    res.set("Cache-Control", "no-cache");
    res.sendFile(resolve(dist, "index.html"));
  });
  app.use((error, req, res, _next) => {
    const status = error.status ?? 500;
    if (status >= 500)
      console.error("EggPro request failed:", error.code ?? error.name);
    res
      .status(status)
      .json({
        error:
          status >= 500
            ? "Cloud service unavailable. Your saved phone records are kept."
            : status === 413
              ? "Farm backup is too large."
              : error.message,
      });
  });
  return app;
}
