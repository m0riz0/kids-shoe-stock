# 👟 Kids Shoe Stock

子供の靴のストックを家族で管理する Web アプリ。

**本番**: https://kids-shoe-stock.vercel.app

## これはなに？

妻からの「子供の靴、どのサイズまで買ってあったっけ？がわからない」という要望から生まれた、家族用のミニマムアプリです。

うちは子供の成長に備えて、セールのときに先のサイズの靴を買ってストックしておくのですが、その在庫が完全に記憶頼みでした。結果、同じサイズを二度買ったり、買ったはずの靴が押入れのどこかへ消えたり…。店頭で靴を手に取った瞬間に「このサイズ持ってたっけ？」へ3秒で答えられること、それだけを目指して作っています。

なので機能は最小限です。子供ごとに、靴のサイズ・用途（家/園庭/上履き）・状態（使用中/ストック/サイズアウト）・保管場所を記録して、夫婦どちらのスマホからでも見られる。以上。

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
