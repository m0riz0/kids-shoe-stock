# 06. API 設計

> 本プロジェクトは**自前の API を実装しない**。
> Supabase が自動生成する API（PostgREST / Auth / Storage）を supabase-js 経由で直接利用する。
> 本書は「どの画面が・どの API を・どの権限で呼ぶか」の対応表として機能する。

## 1. API の全体像

| 種別 | エンドポイント | 認可 |
|------|----------------|------|
| データ CRUD | `/rest/v1/{table}`（PostgREST） | RLS（[05_database-design.md](05_database-design.md) §3） |
| RPC | `/rest/v1/rpc/{fn}` | 関数内で auth.uid() とメンバーシップを検証 |
| 認証 | `/auth/v1/*`（GoTrue） | ― |
| 写真 | `/storage/v1/object/*` | Storage RLS（パスの family_id） |
| 自前 Route Handler | `GET /auth/callback` のみ | ―（コード交換のみ） |

クライアントの種類は 2 つ：

- **ブラウザ**（`src/lib/supabase/client.ts`）— 書き込み系・RPC・Storage
- **サーバー**（`src/lib/supabase/server.ts`、Cookie 連携）— Server Components からの読み取り系

いずれも anon キー（publishable key）+ ユーザーの JWT で動作し、権限は完全に RLS 依存。
service_role キーはアプリからは使用しない（RLS テストスクリプトのみが使用）。

## 2. 画面 × API 対応表

### 認証（FR-A）

| 操作 | 呼び出し | 発行元 |
|------|----------|--------|
| Google サインイン | `auth.signInWithOAuth({ provider: "google" })` → `/auth/callback` で `exchangeCodeForSession` | `/login` → Route Handler |
| パスワードサインイン / サインアップ（開発用） | `auth.signInWithPassword` / `auth.signUp` | `/login` |
| サインアウト | `auth.signOut()` | `/settings` |
| セッション検証 | `auth.getClaims()`（ローカル JWT 検証） | Proxy（毎リクエスト） |

### Family / オンボーディング（FR-F）

| 操作 | 呼び出し | 発行元 |
|------|----------|--------|
| 家族を作る | `rpc("create_family")` | `/onboarding` |
| 招待コードで参加 | `rpc("join_family_by_code", { invite_code })` | `/onboarding` |
| 招待コード発行 | `rpc("create_family_invite", { target_family_id })` | `/settings` |
| 所属 Family 取得 | `from("family_members").select("family_id").limit(1).single()` | 各所 |

### 子供（FR-C）

| 操作 | 呼び出し | 発行元 |
|------|----------|--------|
| 一覧取得 | `from("children").select(...).order("sort_order")` | `/`（RSC） |
| 追加 | `from("children").insert({ family_id, name, sort_order })` | ホームのタブ「＋」 |

### 靴（FR-S / FR-L）

| 操作 | 呼び出し | 発行元 |
|------|----------|--------|
| 一覧取得（家族全体） | `from("shoes").select(...).order("size")` | `/`（RSC） |
| 詳細取得 | `from("shoes").select(...).eq("id", id).single()` | `/shoes/[id]`（RSC） |
| 登録 | `from("shoes").insert({...})` | `/shoes/new` |
| 編集 | `from("shoes").update({...}).eq("id", id)` | `/shoes/[id]/edit` |
| 1タップ状態変更 | `from("shoes").update({ status }).eq("id", id)`（楽観的更新 + 失敗時ロールバック） | ホームのバッジ |
| 削除 | `from("shoes").delete().eq("id", id)` | `/shoes/[id]` |

### 写真（FR-S-5, 6）

| 操作 | 呼び出し | 発行元 |
|------|----------|--------|
| アップロード | クライアントで圧縮（長辺1200px / JPEG 0.8）→ `storage.from("shoe-photos").upload("{family_id}/{shoe_id}/{name}", blob)` → `from("shoe_photos").insert(...)` | ShoeForm |
| 表示 | `storage.from("shoe-photos").createSignedUrl(path, 期限)` | `/shoes/[id]`（RSC） |
| 削除 | `storage.remove([path])` + `shoe_photos` の行削除 | 編集・削除時 |

## 3. エラーハンドリング方針

- PostgREST / RLS 拒否: UPDATE・DELETE は「0 行影響」として静かに失敗するため、
  返却行数や `error` を確認し、楽観的更新はロールバックする（HomeClient の状態変更が該当）
- RPC: 関数内の `raise exception 'identifier'` をクライアントで日本語メッセージへ変換
- Auth: `/login` の `authErrorMessage()` が既知パターン（6文字未満・登録済み・認証情報不一致・レート制限）を
  日本語化し、未知のエラーは原文併記で表示する

## 4. API を自前実装しない理由（設計判断）

1. 認可は RLS で完結しており、API 層を挟んでも検証ロジックが増えるだけで防御は厚くならない
2. 家族数人・数百行規模で、集計・変換などサーバー側処理の必要がない
3. Vercel Functions の実行時間・コールドスタートを気にしなくてよい（静的アセット + RSC のみ）

**将来 API 層が必要になる兆候**: 外部サービス連携（秘密鍵を持つ処理）、レート制御が必要な公開機能、
複数テーブルへの複雑なトランザクション（現状は RPC で足りている）。その際も、まず Postgres 関数
（RPC）で表現できないかを検討してから Route Handler を追加すること。
