-- Run this once in the Supabase SQL editor, then enable GitHub Auth.
create table if not exists public.votes (
  article_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  reason text check (reason is null or reason in (
    'irrelevant', 'known', 'duplicate', 'summary_quality', 'source_quality'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

alter table public.votes enable row level security;

drop policy if exists "read own vote" on public.votes;
create policy "read own vote" on public.votes
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own vote" on public.votes;
create policy "insert own vote" on public.votes
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own vote" on public.votes;
create policy "update own vote" on public.votes
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own vote" on public.votes;
create policy "delete own vote" on public.votes
  for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.touch_vote_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_vote_updated_at on public.votes;
create trigger set_vote_updated_at
before update on public.votes
for each row execute function public.touch_vote_updated_at();

create or replace function public.get_vote_totals(article_ids text[])
returns table(article_id text, up_count bigint, down_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.article_id,
    count(*) filter (where v.vote = 1) as up_count,
    count(*) filter (where v.vote = -1) as down_count
  from public.votes v
  where v.article_id = any(article_ids)
  group by v.article_id;
$$;

create or replace function public.get_recommendation_signals()
returns table(article_id text, weighted_score numeric, total_votes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with attributed as (
    select
      v.article_id,
      v.vote,
      coalesce(
        u.raw_user_meta_data ->> 'user_name',
        u.raw_user_meta_data ->> 'preferred_username',
        ''
      ) = 'LuckygirlYali' as is_owner
    from public.votes v
    join auth.users u on u.id = v.user_id
  )
  select
    a.article_id,
    round(
      0.7 * coalesce(max(a.vote) filter (where a.is_owner), 0)
      + 0.3 * coalesce(avg(a.vote) filter (where not a.is_owner), 0),
      4
    ) as weighted_score,
    count(*) as total_votes
  from attributed a
  group by a.article_id;
$$;

revoke all on function public.get_vote_totals(text[]) from public;
grant execute on function public.get_vote_totals(text[]) to anon, authenticated;
revoke all on function public.get_recommendation_signals() from public;
grant execute on function public.get_recommendation_signals() to anon, authenticated;
grant select, insert, update, delete on public.votes to authenticated;
