-- ============================================================
-- Kids Shoe Stock: initial schema
-- Family 単位のマルチテナント構成。全テーブル RLS 必須。
-- ============================================================

-- ---------- enums ----------

create type public.shoe_category as enum ('home', 'yard', 'indoor');
create type public.shoe_status as enum ('in_use', 'stock', 'outgrown');

-- ---------- tables ----------

-- Supabase Auth のユーザーと 1:1 のプロフィール
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '我が家',
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id  uuid not null references public.families (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index family_members_user_id_idx on public.family_members (user_id);

-- 招待コード（配偶者の参加用）
create table public.family_invites (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  code       text not null unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  used_by    uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index family_invites_family_id_idx on public.family_invites (family_id);

create table public.children (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create index children_family_id_idx on public.children (family_id);

create table public.shoes (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references public.children (id) on delete cascade,
  -- RLS ポリシーの簡潔さと性能のための非正規化（child 経由の join を避ける）
  family_id  uuid not null references public.families (id) on delete cascade,
  category   public.shoe_category not null,
  size       numeric(3, 1) not null check (size >= 10.0 and size <= 30.0),
  status     public.shoe_status not null default 'stock',
  brand      text,
  storage_location text,
  storage_note     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shoes_child_id_idx on public.shoes (child_id);
create index shoes_family_id_idx on public.shoes (family_id);

-- 写真（DB は複数枚対応、UI は当面1枚）
create table public.shoe_photos (
  id           uuid primary key default gen_random_uuid(),
  shoe_id      uuid not null references public.shoes (id) on delete cascade,
  family_id    uuid not null references public.families (id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

create index shoe_photos_shoe_id_idx on public.shoe_photos (shoe_id);

-- ---------- helper functions ----------

-- RLS ポリシーから呼ぶ所属判定。
-- security definer にすることで family_members 自身の RLS による再帰を回避する。
create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_family_id
      and fm.user_id = (select auth.uid())
  );
$$;

-- shoes.family_id が child の family と一致することを強制する
create or replace function public.enforce_shoe_family()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  child_family uuid;
begin
  select family_id into child_family from public.children where id = new.child_id;
  if child_family is null then
    raise exception 'child not found';
  end if;
  new.family_id := child_family;
  return new;
end;
$$;

create trigger shoes_enforce_family
  before insert or update of child_id on public.shoes
  for each row execute function public.enforce_shoe_family();

-- shoe_photos.family_id を shoe から強制する
create or replace function public.enforce_photo_family()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shoe_family uuid;
begin
  select family_id into shoe_family from public.shoes where id = new.shoe_id;
  if shoe_family is null then
    raise exception 'shoe not found';
  end if;
  new.family_id := shoe_family;
  return new;
end;
$$;

create trigger shoe_photos_enforce_family
  before insert or update of shoe_id on public.shoe_photos
  for each row execute function public.enforce_photo_family();

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger shoes_set_updated_at
  before update on public.shoes
  for each row execute function public.set_updated_at();

-- 新規サインアップ時にプロフィールを自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Family 作成（作成者を同時に所属させる）。クライアントから RPC で呼ぶ。
create or replace function public.create_family(family_name text default '我が家')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_family_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  insert into public.families (name) values (coalesce(nullif(trim(family_name), ''), '我が家'))
  returning id into new_family_id;
  insert into public.family_members (family_id, user_id) values (new_family_id, uid);
  return new_family_id;
end;
$$;

-- 招待コード発行（8桁英数・7日間有効）
create or replace function public.create_family_invite(target_family_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_code text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_family_member(target_family_id) then
    raise exception 'not a member of this family';
  end if;
  -- 紛らわしい文字 (0/O/1/I/L) を除いた8文字
  select string_agg(
           substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', (floor(random() * 31) + 1)::int, 1), ''
         )
    into new_code
    from generate_series(1, 8);
  insert into public.family_invites (family_id, code, created_by, expires_at)
  values (target_family_id, new_code, uid, now() + interval '7 days');
  return new_code;
end;
$$;

-- 招待コードで Family に参加
create or replace function public.join_family_by_code(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  invite record;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select * into invite
    from public.family_invites
    where code = upper(trim(invite_code))
    for update;
  if invite is null then
    raise exception 'invalid_code';
  end if;
  if invite.used_at is not null then
    raise exception 'code_already_used';
  end if;
  if invite.expires_at < now() then
    raise exception 'code_expired';
  end if;
  insert into public.family_members (family_id, user_id)
  values (invite.family_id, uid)
  on conflict do nothing;
  update public.family_invites
    set used_at = now(), used_by = uid
    where id = invite.id;
  return invite.family_id;
end;
$$;

-- ---------- RLS ----------

alter table public.profiles       enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.children       enable row level security;
alter table public.shoes          enable row level security;
alter table public.shoe_photos    enable row level security;

-- profiles: 本人のみ
create policy "profiles_select_own" on public.profiles
  for select using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update using (id = (select auth.uid()));

-- families: 所属メンバーのみ閲覧・更新（作成は create_family RPC 経由）
create policy "families_select_member" on public.families
  for select using (public.is_family_member(id));
create policy "families_update_member" on public.families
  for update using (public.is_family_member(id));

-- family_members: 同じ Family のメンバーを閲覧できる
create policy "family_members_select_member" on public.family_members
  for select using (public.is_family_member(family_id));
-- 追加・削除は RPC (create_family / join_family_by_code) 経由のみ。
-- 自分自身の脱退のみ直接許可する。
create policy "family_members_delete_self" on public.family_members
  for delete using (user_id = (select auth.uid()));

-- family_invites: 発行 Family のメンバーのみ閲覧（発行/使用は RPC 経由）
create policy "family_invites_select_member" on public.family_invites
  for select using (public.is_family_member(family_id));

-- children: Family メンバーのみ全操作
create policy "children_select_member" on public.children
  for select using (public.is_family_member(family_id));
create policy "children_insert_member" on public.children
  for insert with check (public.is_family_member(family_id));
create policy "children_update_member" on public.children
  for update using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
create policy "children_delete_member" on public.children
  for delete using (public.is_family_member(family_id));

-- shoes: Family メンバーのみ全操作
-- insert 時の family_id はトリガーで child から強制されるが、
-- with check で child の所属も検証する（他家庭の child への登録を防ぐ）
create policy "shoes_select_member" on public.shoes
  for select using (public.is_family_member(family_id));
create policy "shoes_insert_member" on public.shoes
  for insert with check (
    public.is_family_member(family_id)
  );
create policy "shoes_update_member" on public.shoes
  for update using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
create policy "shoes_delete_member" on public.shoes
  for delete using (public.is_family_member(family_id));

-- shoe_photos: Family メンバーのみ全操作
create policy "shoe_photos_select_member" on public.shoe_photos
  for select using (public.is_family_member(family_id));
create policy "shoe_photos_insert_member" on public.shoe_photos
  for insert with check (public.is_family_member(family_id));
create policy "shoe_photos_delete_member" on public.shoe_photos
  for delete using (public.is_family_member(family_id));

-- ---------- Storage ----------

-- 靴写真バケット（非公開）。パス規約: {family_id}/{shoe_id}/{filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shoe-photos',
  'shoe-photos',
  false,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "shoe_photos_storage_select" on storage.objects
  for select using (
    bucket_id = 'shoe-photos'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "shoe_photos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'shoe-photos'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "shoe_photos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'shoe-photos'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );
