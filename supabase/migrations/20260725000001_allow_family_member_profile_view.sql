-- 設定画面で家族メンバーの表示名/メールが「不明なユーザー」になる不具合の修正。
-- 原因: profiles の SELECT ポリシーが本人のみで、配偶者側の profile 行が RLS で
-- 見えず、settings ページの family_members(profiles(...)) join が null になっていた。

create or replace function public.shares_family_with(target_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.family_members fm1
    join public.family_members fm2 on fm1.family_id = fm2.family_id
    where fm1.user_id = target_user
      and fm2.user_id = (select auth.uid())
  );
$$;

create policy "profiles_select_family_member" on public.profiles
  for select using (public.shares_family_with(id));
