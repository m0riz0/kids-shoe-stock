# 👟 Kids Shoe Stock

子供の靴のストックを家族で管理する Web アプリ。

**本番**: https://kids-shoe-stock.vercel.app

## 構成

- Next.js 16 (App Router) / React 19 / Tailwind CSS 4
- Supabase（Auth / Postgres + RLS / Storage）— クラウド東京リージョン
- Vercel（main への push で自動デプロイ）

## 開発

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run test:rls   # RLS 統合テスト（.env.test が必要）
```

環境変数は `.env.local` に設定する（gitignore 済み）:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_ENABLE_PASSWORD_AUTH=true   # 開発用パスワードサインインの表示
```

## データベース

スキーマ変更は `supabase/migrations/` にマイグレーションを追加し、`supabase db push` でクラウドに反映する。認証まわりの設定は `supabase/config.toml` を編集して `supabase config push`。
