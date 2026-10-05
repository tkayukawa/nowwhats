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

## コマンド

| コマンド              | 内容                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| `pnpm run check`      | CI と同じ全チェック（整形・依存ルール・型・lint・テスト）。PR 前に必ず通す |
| `pnpm run typecheck`  | 型チェック（全パッケージ）                                                 |
| `pnpm run lint`       | ESLint                                                                     |
| `pnpm run test`       | Vitest                                                                     |
| `pnpm run deps:check` | dependency-cruiser による依存方向チェック                                  |
| `pnpm run format`     | Prettier で整形                                                            |

特定パッケージだけ実行する場合は `pnpm --filter @nowwhats/task-management test` のように指定する。

## リポジトリ構成

```
packages/
  shared-kernel/       # Result 型、OwnerId など全コンテキスト共通の最小要素
  task-management/
    src/domain/        # 集約・値オブジェクト・ドメインイベント・Repository I/F
    src/application/   # ユースケース・Port I/F
    src/index.ts       # 公開 API（他パッケージはここからのみ import する）
apps/                  # api / web などのアプリ（ステップ 3 以降で追加）
```

- 内部パッケージはビルドせず、`exports` で `src/index.ts` を直接公開する。型チェックは `tsc --noEmit`、実行時の変換は Vitest や各アプリのバンドラーが行う。
- 相対 import には拡張子 `.ts` を付ける（`allowImportingTsExtensions`）。

## 依存ルール（`.dependency-cruiser.cjs` で強制）

| ルール                            | 内容                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `domain-is-pure`                  | `domain` は同一パッケージの `domain` と `shared-kernel` 以外に依存しない。npm パッケージ・Node 組み込みモジュールも禁止 |
| `application-depends-only-inward` | `application` は同一パッケージの `domain` / `application` と `shared-kernel` 以外に依存しない                           |
| `shared-kernel-is-pure`           | `shared-kernel` は外部に依存しない                                                                                      |
| `cross-package-via-public-api`    | 他パッケージの内部ファイルを直接 import しない（`src/index.ts` 経由のみ）                                               |
| `no-circular`                     | 循環依存の禁止                                                                                                          |

- テストファイル（`*.test.ts`）は `vitest` の import を許可するため、純粋性ルールの対象外とする。
- 加えて `tsconfig.base.json` で `lib: ["ES2023"]`・`types: []` とし、`domain` / `application` で DOM や Node.js の型が使えないようにしている（全プラットフォームで動かすため。ADR 0001）。

## コーディング規約

- ドメインの想定内エラーは例外ではなく `Result` 型（`@nowwhats/shared-kernel`）で返す。
- 集約の状態変更は集約のメソッド経由でのみ行い、発生したドメインイベントは `pullEvents()` で取り出す。
- ID・時刻は Port（`TaskIdGenerator` / `Clock`）から受け取り、ドメイン内で生成しない。

## バージョン管理

- 依存パッケージは厳密なバージョンで追加する（`pnpm-workspace.yaml` の `savePrefix: ""`）。
- リリースから 7 日未満の版はインストールしない（CLAUDE.md「パッケージ・モジュールのインストールルール」）。
  - `pnpm-workspace.yaml` の `minimumReleaseAge: 10080` で、間接依存も含めて pnpm が自動的に除外する。
  - pnpm 本体（`packageManager`）と GitHub Actions はこの設定の対象外のため、更新時に手動でリリース日を確認する。
- GitHub Actions は commit SHA でピン留めし、タグをコメントで併記する。
