-- Run once in the SQL Editor of a new Supabase project.
begin;
create table if not exists public.eggpro_farms (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  mutation_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.eggpro_farms enable row level security;
revoke all on public.eggpro_farms from anon, authenticated;
grant select on public.eggpro_farms to authenticated;
create policy "Read your own farm" on public.eggpro_farms for select to authenticated
  using ((select auth.uid()) = owner_id);
-- Clients cannot write directly or select anyone else's farm. The RPC is the only
-- write path and checks auth.uid() even though it runs as its database owner.
create or replace function public.save_eggpro_farm(
  expected_owner uuid, expected_revision bigint, new_document jsonb, request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.eggpro_farms; result public.eggpro_farms;
begin
  if auth.uid() is null or auth.uid() <> expected_owner then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if request_id is null or expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid save request' using errcode = '22023';
  end if;
  if new_document is null or jsonb_typeof(new_document) <> 'object'
    or new_document->>'format' is distinct from 'FarmTrack'
    or new_document->>'version' is distinct from '1'
    or new_document->>'schemaVersion' is distinct from '2'
    or jsonb_typeof(new_document->'data') is distinct from 'object'
    or jsonb_typeof(new_document->'data'->'farms') is distinct from 'array'
    or jsonb_array_length(new_document->'data'->'farms') <> 1
    or octet_length(new_document::text) > 10000000 then
    raise exception 'Invalid or oversized farm data' using errcode = '22023';
  end if;
  -- Serialize concurrent first saves as well as updates for this account.
  perform pg_advisory_xact_lock(hashtextextended(expected_owner::text, 0));
  select * into current_row from public.eggpro_farms where owner_id = expected_owner;
  if found then
    if current_row.mutation_id = request_id then
      return to_jsonb(current_row) - 'owner_id' - 'document';
    end if;
    if current_row.revision <> expected_revision then
      raise exception 'Farm changed on another device' using errcode = '40001';
    end if;
    update public.eggpro_farms set document = new_document, revision = revision + 1,
      mutation_id = request_id, updated_at = now() where owner_id = expected_owner returning * into result;
  else
    if expected_revision <> 0 then
      raise exception 'Farm changed on another device' using errcode = '40001';
    end if;
    insert into public.eggpro_farms(owner_id, revision, document, mutation_id)
      values (expected_owner, 1, new_document, request_id) returning * into result;
  end if;
  return to_jsonb(result) - 'owner_id' - 'document';
end;
$$;
revoke all on function public.save_eggpro_farm(uuid, bigint, jsonb, uuid) from public, anon;
grant execute on function public.save_eggpro_farm(uuid, bigint, jsonb, uuid) to authenticated;
commit;
