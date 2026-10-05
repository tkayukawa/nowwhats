# CLAUDE.md

このファイルは、Claude Code（および他の AI コーディングエージェント）が本リポジトリで作業する際に必ず守るルールを定義する。

## プロジェクト概要

nowwaths は、キー入力や音声入力でタスクを手軽に登録し、進捗や成果を可視化するタスク管理アプリです。

## リポジトリ構成

| パス | 役割 |
|---|---|
| `docker/` | Cloud Run 向けコンテナ定義 |
| `terraform/` | IaC ルートモジュール。環境はディレクトリ分割ではなく `tfvars/{dev,sandbox,prod}.tfvars` で切替 |
| `terraform/modules/gcp/` | 自作モジュール置き場。1 モジュール = `main.tf` 1 ファイル（規約: `terraform/modules/README.md`） |
| `terraform/tfvars/` | 環境別変数（`<stage>.tfvars`）と backend 設定（`<stage>.backend.tfvars`） |
| `.devcontainer/` | 開発コンテナ定義。ホストの SSH/gcloud 認証を安全に共有する構成 |
| `Makefile` | すべての運用操作の入口（Terraform 実行、イメージビルド等） |
| `agent_tasks/` | 次に着手するタスク置き場。GCP 利用の共通ルールも `agent_tasks/README.md` に定義 |
| `tools/` | Data Agent 登録・カタログ登録などの運用スクリプト |
| `docs/` | ドキュメント。実装者向け詳細は `docs/developer/` に置く |

## 必須ルール

### Terraform 操作
- **Terraform は必ず Makefile 経由で操作する**（`make tf-plan STAGE=dev` 等)。`terraform` コマンドの直接実行は、backend-config や -var の指定漏れを招くため禁止。
- 環境切替は `STAGE=dev|sandbox|prod` のみで行う。tfvars ファイルを書き換えて環境を混ぜない。
- インフラリソースはすべて Terraform で管理する。コンソール等での手動変更は原則禁止。
- コード変更後は **`make tf-check`（fmt チェック + validate + tflint）を必ず通す**。fmt 差分は `make tf-fmt` で解消する。

### 命名規則・コーディング規約
- リソース命名は `${service_name}-<用途>-${stage}`（例: `${service_name}-sa-${stage}`）。モジュール内の `locals` で組み立てる。
- 新規モジュールは `terraform/modules/{aws,gcp}/<name>/main.tf` に variables/outputs を同居させる 1 ファイルスタイルで作成する（雛形と規約: `terraform/modules/README.md`）。
- すべての variable に `description` を付ける（tflint で強制される）。
- 環境固有値（プロジェクト ID、VPC ID 等）は `.tf` に直書きせず `tfvars/` に置く。

### バージョン管理
- provider / devcontainer features / GitHub Actions のバージョンは厳密にピン留めする。更新は専用 PR で行う。
- GitHub Actions は commit SHA でピン留めする（`bash tools/pinact.sh` で更新）。
- `terraform/.terraform.lock.hcl` はコミット対象。provider 更新時は再生成してコミットする。
- devcontainer の features を変更したら `devcontainer-lock.json` を再生成してコミットする。

## 禁止事項

- `make tf-apply STAGE=prod` の手動実行禁止。**prod への apply は CI（production ブランチ push）経由のみ**。
- `terraform apply` への `-auto-approve` の手動付与禁止（CI の `ci-tf-apply` のみ許可）。
- `make tf-destroy`、`terraform state rm/mv` は、ユーザーの明示的な事前承認なしに実行しない。
- 機密値（API キー、パスワード、接続文字列、`credentials/` 配下のファイル、`.env*`）のコミット・ログ出力・回答への記載禁止。シークレットは Secret Manager 等を参照する。
- `git push --force` 禁止。`main` / `production` への直接 push 禁止（必ず PR 経由）。

## ドキュメント更新ルール

- 仕様・挙動が変わる PR では、関連ドキュメント(README / docs/)を**同時に**更新する。
- 利用者向けの説明は `README.md`、実装者向け詳細は `docs/developer/` に書く。
- 実装とドキュメントに差分が出た場合は、実装を優先しドキュメントを即時修正する。

## コミット・ブランチ規約

- コミットメッセージは Conventional Commits 形式のプレフィックス（`feat:` / `fix:` / `docs:` / `refac:` / `cicd:` / `wip:` 等）+ 日本語本文。
- ブランチ運用: PR マージ → `main`（dev 環境へ自動デプロイ）→ 動作確認後 `production` へ昇格（prod 環境へ自動デプロイ）。