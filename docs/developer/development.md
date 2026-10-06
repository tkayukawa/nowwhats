# 開発ガイド

## 前提

| ツール  | バージョン                                | 備考                                     |
| ------- | ----------------------------------------- | ---------------------------------------- |
| Node.js | `.node-version` に記載                    |                                          |
| pnpm    | `package.json` の `packageManager` に記載 | Corepack 経由で利用（`corepack enable`） |

## セットアップ

```bash
corepack enable
pnpm install
```

## ローカルで動かす

```bash
pnpm run dev
```

- `apps/api`（http://127.0.0.1:8787）と `apps/web`（Vite の開発サーバー。URL は起動ログに表示）が同時に起動する。
- Web からの `/api` へのリクエストは Vite の proxy で API サーバーへ中継される。
- Web はタスクをブラウザ内の SQLite（OPFS）に保存し、オフラインでも登録・状態変更ができる。オンライン時に自動で同期する（起動時・オンライン復帰時・操作の直後・30 秒ごと）。
- 現時点の制約:
  - API サーバーのデータはメモリ上に保存するため、再起動すると消える。再起動するとクライアントは epoch の変化を検知し、サーバーの状態（空）に合わせてローカルのタスクも消える（ADR 0006）。
  - 認証は未実装で、全リクエストを開発用の固定利用者（`dev-user`）として扱う。`NODE_ENV=production` では API が起動しない。外部に公開しないこと。
  - 開発サーバー（`pnpm run dev`）では Service Worker を登録しないため、オフライン中に再読み込みすると画面が開けない。オフラインでの画面読み込みは、下記「本番ビルドで確認する」の手順で確認する。
  - 同じブラウザの 2 つ目のタブはメモリ保存に切り替わる（OPFS の SAH プール方式は同時に 1 タブのみ）。
- ローカル DB を消すには、ブラウザの開発者ツールでサイトのデータ（ストレージ）を削除する。

### 本番ビルドで確認する（Service Worker）

```bash
pnpm run dev                                    # API を起動するため（別ターミナル）
pnpm --filter @nowwhats/web build
pnpm --filter @nowwhats/web preview             # http://localhost:4173 で配信。/api は API サーバーへ中継
```

- Service Worker（`apps/web/public/sw.js`）は本番ビルドでのみ登録する。開発サーバーの HMR と干渉させないため。
- ビルド時に `precache-manifest.json`（ビルド成果物の一覧と版）を出力し、Service Worker がインストール時にまとめてキャッシュする。Worker・`.wasm` も含めて初回表示時点でキャッシュするため。
- 画面の読み込みはネットワーク優先（オフライン時はキャッシュ）、その他のファイルはキャッシュ優先。`/api` はキャッシュしない。
- 新しい版をデプロイすると、次回の読み込みで新しい Service Worker がインストールされ、古いキャッシュは削除される。
- ポートが異なると別オリジンになるため、`preview`（4173）と `dev`（5173）のローカル DB は別々になる。
- Service Worker を解除するには、開発者ツールの Application → Service workers → Unregister を使う。

## コマンド

| コマンド              | 内容                                                                               |
| --------------------- | ---------------------------------------------------------------------------------- |
| `pnpm run check`      | CI と同じ全チェック（整形・依存ルール・型・lint・テスト・ビルド）。PR 前に必ず通す |
| `pnpm run dev`        | API と Web の開発サーバーを起動                                                    |
| `pnpm run build`      | ビルド（現時点では Web のみ）                                                      |
| `pnpm run typecheck`  | 型チェック（全パッケージ）                                                         |
| `pnpm run lint`       | ESLint                                                                             |
| `pnpm run test`       | Vitest                                                                             |
| `pnpm run deps:check` | dependency-cruiser による依存方向チェック                                          |
| `pnpm run format`     | Prettier で整形                                                                    |

特定パッケージだけ実行する場合は `pnpm --filter @nowwhats/task-management test` のように指定する。

## リポジトリ構成

```
packages/
  shared-kernel/       # Result 型、OwnerId など全コンテキスト共通の最小要素
  task-management/
    src/domain/        # 集約・値オブジェクト・ドメインイベント・Repository I/F
    src/application/   # ユースケース・Port I/F
    src/testing/       # テスト用の部品（公開 API には含めない）
    src/index.ts       # 公開 API（他パッケージはここからのみ import する）
  sync/                # 同期の取り決め（操作・結果の型）とユースケース（ADR 0006）
  infrastructure-server/ # サーバー用 Adapter（現時点はメモリ上の Repository・変更ログ・処理済み記録）
  infrastructure-client/ # クライアント用 Adapter（SQLite のローカル保存・マイグレーション・UUIDv7）
apps/
  api/                 # Hono による HTTP API。src/main.ts が Composition Root
  web/                 # Vite + React の Web クライアント
    src/local/         # ローカル DB と同期を動かす Web Worker と、その呼び出し
    src/ui/            # 画面の部品（Tailwind CSS）
    src/task-view.ts   # 一覧の並び順・絞り込み・期限表示の判断（部品から切り離してテストする）
```

### 画面のスタイル（Tailwind CSS）

- 色とフォントは `apps/web/src/styles.css` で CSS 変数（`--nw-*`）として定義し、`@theme inline` で Tailwind の色名（`bg-surface`、`text-muted`、`text-accent` など）に対応づけている。部品では色の値を直接書かず、この色名を使う。
- ダークモードは端末の設定（`prefers-color-scheme`）に従う。変数の値だけを切り替えるので、部品側に `dark:` の指定は不要。
- 日本語は端末のフォントを使い、ロゴと数字は同梱の Outfit（`@fontsource/outfit`）を使う（`font-mark`）。

### Markdown の表示

- 説明文は `marked` で HTML に変換し、**必ず `DOMPurify` で無害化してから** 表示する（`apps/web/src/ui/markdown.tsx` の `renderMarkdown`）。`dangerouslySetInnerHTML` には `renderMarkdown` の結果以外を渡さない。
- リンクは新しいタブで開き、`rel="noopener noreferrer"` を付ける。

### クライアント（Web）の構成

```
メインスレッド（React）  ──postMessage──▶  Web Worker（src/local/db-worker.ts）
  useLocalTasks                              ExecuteLocalCommand / SynchronizeWithServer（packages/sync）
                                             SqliteLocalStore（packages/infrastructure-client）
                                             sqlite-wasm + OPFS（SAH プール方式）
```

- ローカル DB と同期処理は Web Worker で動かす。OPFS の SAH プール方式は Worker 専用のため。トランザクションは `SqliteLocalStore` が 1 本の列に並べて順番に実行する。
- ローカル DB のスキーマは `packages/infrastructure-client/src/migrations.ts` で管理する。既存のマイグレーションは変更せず、末尾に追加する。
- SQL の実行は `SqlDatabase` インターフェース経由にしている。将来 expo-sqlite（モバイル）や Tauri（デスクトップ）の Adapter を用意すれば、同じ Repository を使い回せる。
- OPFS が使えない環境ではメモリ DB にフォールバックし、画面に警告を表示する。

- 内部パッケージはビルドせず、`exports` で `src/index.ts` を直接公開する。型チェックは `tsc --noEmit`、実行時の変換は Vitest や各アプリのバンドラーが行う。
- `apps/api` は Node.js 標準の TypeScript 実行（型注釈の除去）でそのまま動かす。そのため `erasableSyntaxOnly` を有効にしており、コンストラクタ引数プロパティ（`constructor(private x)`）・`enum`・`namespace` などは使えない。
- 相対 import には拡張子 `.ts` を付ける（`allowImportingTsExtensions`）。
- API の型は Hono RPC で Web と共有する（`apps/api/src/app.ts` の `AppType`。ADR 0005）。

## 依存ルール（`.dependency-cruiser.cjs` で強制）

| ルール                            | 内容                                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain-is-pure`                  | `domain` は同一パッケージの `domain` と `shared-kernel` 以外に依存しない。npm パッケージ・Node 組み込みモジュールも禁止                                           |
| `application-depends-only-inward` | `application` は同一パッケージの `domain` / `application`、`shared-kernel`、他コンテキストの公開 API（`src/index.ts`。`infrastructure-*` は除く）以外に依存しない |
| `shared-kernel-is-pure`           | `shared-kernel` は外部に依存しない                                                                                                                                |
| `cross-package-via-public-api`    | 他パッケージの内部ファイルを直接 import しない（`src/index.ts` 経由のみ）                                                                                         |
| `no-circular`                     | 循環依存の禁止                                                                                                                                                    |

- テストファイル（`*.test.ts`）は `vitest` の import を許可するため、純粋性ルールの対象外とする。
- 加えて `tsconfig.base.json` で `lib: ["ES2023"]`・`types: []` とし、`domain` / `application` で DOM や Node.js の型が使えないようにしている（全プラットフォームで動かすため。ADR 0001）。

## コーディング規約

- ドメインの想定内エラーは例外ではなく `Result` 型（`@nowwhats/shared-kernel`）で返す。
- 集約の状態変更は集約のメソッド経由でのみ行い、発生したドメインイベントは `pullEvents()` で取り出す。
- 時刻は `Clock` Port から受け取り、ドメイン内で生成しない。
- タスク ID はクライアントで UUIDv7 を生成して渡す（ADR 0002）。サーバーは形式を検証し、同じ ID の再登録は拒否する。

## バージョン管理

- 依存パッケージは厳密なバージョンで追加する（`pnpm-workspace.yaml` の `savePrefix: ""`）。
- リリースから 7 日未満の版はインストールしない（CLAUDE.md「パッケージ・モジュールのインストールルール」）。
  - `pnpm-workspace.yaml` の `minimumReleaseAge: 10080` で、間接依存も含めて pnpm が自動的に除外する。
  - pnpm 本体（`packageManager`）と GitHub Actions はこの設定の対象外のため、更新時に手動でリリース日を確認する。
- インストール時スクリプト（postinstall 等）は pnpm の既定で実行されない。実行を許可する場合は理由を PR に記載する。
- GitHub Actions は commit SHA でピン留めし、タグをコメントで併記する。
