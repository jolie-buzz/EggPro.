import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let pg: PGlite;
const alice = "00000000-0000-4000-8000-000000000001",
  bob = "00000000-0000-4000-8000-000000000002";
const doc = {
  format: "FarmTrack",
  version: 1,
  schemaVersion: 2,
  data: { farms: [{ id: "farm" }] },
};
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; insert into auth.users values ('${alice}'),('${bob}');`,
  );
  await pg.exec(
    await readFile("supabase/migrations/202609240001_eggpro.sql", "utf8"),
  );
}, 30000);
afterAll(async () => {
  await pg?.close();
});
async function asUser(user: string, action: () => Promise<unknown>) {
  await pg.exec("set role authenticated");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await action();
  } finally {
    await pg.exec("reset role");
  }
}
it("allows only the owner to read and atomically save, rejecting direct writes and stale versions", async () => {
  const request = "10000000-0000-4000-8000-000000000001";
  const save = () =>
    pg.query("select public.save_eggpro_farm($1,$2,$3,$4) as saved", [
      alice,
      0,
      doc,
      request,
    ]);
  await asUser(alice, save);
  const retry = (await asUser(alice, save)) as {
    rows: { saved: { revision: number } }[];
  };
  expect(retry.rows[0].saved.revision).toBe(1);
  const visible = (await asUser(bob, () =>
    pg.query("select * from public.eggpro_farms"),
  )) as { rows: unknown[] };
  expect(visible.rows).toHaveLength(0);
  await expect(asUser(bob, save)).rejects.toThrow("Authentication");
  await expect(
    asUser(alice, () => pg.query("update public.eggpro_farms set revision=99")),
  ).rejects.toThrow("permission denied");
  await expect(
    asUser(alice, () =>
      pg.query("select public.save_eggpro_farm($1,$2,$3,$4)", [
        alice,
        0,
        doc,
        "10000000-0000-4000-8000-000000000002",
      ]),
    ),
  ).rejects.toThrow("another device");
  await pg.exec("set role anon");
  await expect(pg.query("select * from public.eggpro_farms")).rejects.toThrow(
    "permission denied",
  );
  await expect(save()).rejects.toThrow("permission denied");
  await pg.exec("reset role");
});
