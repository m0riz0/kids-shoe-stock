# 08. ディレクトリ構成

```
kids-shoe-stock/
├── docs/                        # 設計ドキュメント（01〜09）
├── public/
│   └── icons/                   # PWA アイコン（192 / 512 / apple-touch）
├── scripts/
│   └── rls-test.mjs             # RLS 統合テスト（npm run test:rls）
├── supabase/
│   ├── config.toml              # Supabase 設定（auth の URL・メール設定等）。supabase config push で反映
│   └── migrations/              # スキーマの正。supabase db push で反映
│       └── 20260724000001_initial_schema.sql
├── src/
│   ├── proxy.ts                 # Proxy(middleware): セッション更新・未認証リダイレクト
│   ├── app/
│   │   ├── layout.tsx           # ルートレイアウト（lang=ja, PWA メタ）
│   │   ├── manifest.ts          # PWA マニフェスト（FR-X-1）
│   │   ├── globals.css          # Tailwind エントリ
│   │   ├── login/page.tsx       # サインイン（Google + 開発用パスワード）
│   │   ├── onboarding/page.tsx  # Family 作成 / 招待コード参加
│   │   ├── auth/callback/route.ts  # OAuth コード→セッション交換（唯一の Route Handler）
│   │   └── (app)/               # 認証必須の本体（route group）
│   │       ├── layout.tsx       # 所属 Family チェック → なければ /onboarding へ
│   │       ├── page.tsx         # ホーム: サイズ棚一覧（RSC で一括フェッチ）
│   │       ├── settings/page.tsx           # 設定（招待コード・サインアウト）
│   │       └── shoes/
│   │           ├── new/page.tsx            # 靴の登録
│   │           └── [id]/
│   │               ├── page.tsx            # 靴の詳細（写真の署名 URL 生成）
│   │               └── edit/page.tsx       # 靴の編集
│   ├── components/              # クライアントコンポーネント
│   │   ├── HomeClient.tsx       # 子供タブ・サイズ棚・1タップ状態変更（楽観的更新）
│   │   ├── ShoeForm.tsx         # 登録・編集共用フォーム（写真圧縮→アップロード）
│   │   ├── ShoeDetailActions.tsx# 詳細画面の操作（削除等）
│   │   ├── SettingsClient.tsx   # 招待コード発行・コピー・サインアウト
│   │   └── StatusBadge.tsx      # 状態バッジ（使用中/ストック/サイズアウト）
│   └── lib/
│       ├── domain.ts            # ドメイン定数・型（カテゴリ/状態/サイズ選択肢/ラベル）
│       ├── image.ts             # クライアント側画像圧縮（長辺1200px / JPEG 0.8）
│       └── supabase/
│           ├── client.ts        # ブラウザ用クライアント（createBrowserClient）
│           └── server.ts        # サーバー用クライアント（createServerClient + Cookie）
├── AGENTS.md / CLAUDE.md        # AI エージェント向け規約（Next.js 16 のドキュメント参照必須）
├── PROJECT_BRIEF.md             # プロジェクト概要（要件の出発点・最上位の正）
└── package.json
```

## 配置ルール

| 置き場所 | 置くもの | 置かないもの |
|----------|----------|--------------|
| `src/app/` | ルーティングと Server Component（データ取得） | 再利用 UI・ドメインロジック |
| `src/components/` | `"use client"` なコンポーネント | サーバー専用コード |
| `src/lib/` | 環境非依存のドメイン定数・ユーティリティ、Supabase クライアント生成 | React コンポーネント |
| `supabase/` | DB・認証の構成（コードとして管理） | 一時ファイル（`.temp/`・`.branches/` は gitignore） |

### 補足

- **`(app)` route group**: 認証+Family 所属が前提のページを束ね、共通レイアウトで所属チェックを行う。
  URL には現れない
- **環境変数**: `.env.local`（開発）/ Vercel の環境変数（Preview・Production）。
  `.env*` は gitignore。必要なキーは [README.md](../README.md) 参照
- **`src/proxy.ts`**: Next.js 16 では middleware が Proxy と呼ばれる。役割は
  [04_architecture.md](04_architecture.md) §2 参照
