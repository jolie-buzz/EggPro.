-- Dedicated namespace: no existing Neon tables are changed or removed.
CREATE SCHEMA IF NOT EXISTS eggpro;
REVOKE ALL ON SCHEMA eggpro FROM PUBLIC;
CREATE TABLE IF NOT EXISTS eggpro.users (
 id uuid PRIMARY KEY,
 email text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 recovery_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS eggpro.sessions (
 token_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES eggpro.users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user ON eggpro.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON eggpro.sessions(expires_at);
CREATE TABLE IF NOT EXISTS eggpro.farms (
 owner_id uuid PRIMARY KEY REFERENCES eggpro.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL CHECK(revision > 0),
 document jsonb NOT NULL,
 mutation_id uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS eggpro.rate_limits (
 key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA eggpro FROM PUBLIC;
