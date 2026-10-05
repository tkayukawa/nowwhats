# 0001. TypeScript モノレポとオニオンアーキテクチャの採用

- ステータス: 提案
- 日付: 2026-10-05

## コンテキスト

- まず Web アプリとして提供し、将来 Windows / macOS / iOS / Android へ展開する
- オフライン入力が必須であり、ドメインルール（状態遷移・バリデーション）をクライアントでも実行する必要がある
- 設計手法として DDD とオニオンアーキテクチャを採用する

## 決定

1. **全レイヤを TypeScript で統一** する
   - Backend: TypeScript（Web フレームワークは Hono を第一候補とし、実装着手時に確定）
   - Web: React
   - iOS / Android: Expo（React Native）
   - Desktop: Tauri（Electron を代替候補とする）
2. **pnpm workspaces + Turborepo のモノレポ** とする
3. **オニオンアーキテクチャ** を次のパッケージ構成で実現する

```
packages/
  shared-kernel/              # ID・Result 型など最小限の共通要素
  task-management/
    src/domain/               # 外部依存ゼロ。純粋 TS
    src/application/          # ユースケース、Port（I/F）
  capture/ ...
  insights/ ...
  infrastructure-server/      # サーバー用 Adapter（PostgreSQL 等）
  infrastructure-client/      # クライアント用 Adapter（SQLite・同期等）
apps/
  api/                        # HTTP + Composition Root
  web/                        # Web クライアント
  mobile/                     # 将来: Expo
  desktop/                    # 将来: Tauri
```

4. **依存方向のルール**（dependency-cruiser で強制する。詳細は `docs/developer/development.md`）
   - `domain` は他のどのレイヤ・外部ライブラリにも依存しない
   - `application` は `domain` にのみ依存する
   - `infrastructure-*` / `apps/*` は内側のレイヤに依存してよい（逆は禁止）
   - `domain` / `application` では Node.js 固有 API・DOM API・DB ライブラリを使わない（全プラットフォームで動かすため）
   - コンテキスト間は公開 API（index.ts で export したユースケース・イベント）経由でのみ参照する
5. **API はスキーマ駆動** とし、スキーマからクライアントを生成する（OpenAPI または型共有 RPC を実装着手時に選定）

## 検討した代替案

| 案                             | 不採用理由                                               |
| ------------------------------ | -------------------------------------------------------- |
| Flutter + 別言語 Backend       | ドメインロジックが Dart とサーバー言語に二重化しやすい   |
| PWA 中心（Capacitor でラップ） | 音声・バックグラウンド処理等のネイティブ機能に制約がある |

## 結果

- 良い点: ドメイン層を 1 か所に保ち、全プラットフォームとサーバーで再利用できる
- 悪い点: ネイティブ UI の完成度は Flutter／完全ネイティブにやや劣る可能性がある
- 規約: ライブラリ・ツールのバージョンは厳密にピン留めする（CLAUDE.md に準拠）

## 要確認事項

- 各フレームワーク（Expo、Tauri、Hono 等）の最新バージョン・対応プラットフォームは、導入時に公式情報で確認する
