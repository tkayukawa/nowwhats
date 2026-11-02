# 0009. GCP のインフラ構成（Cloud Run 1 コンテナ・Terraform・CI からのデプロイ）

- ステータス: 提案
- 日付: 2026-10-13
- 関連: ADR 0003（Cloud SQL for PostgreSQL）、ADR 0006（同期と epoch）、ADR 0008（Vertex AI 経由の Claude）

## コンテキスト

- 外部公開の前提として、インフラ整備 → 永続化 → 認証 の順に進める。本 ADR はインフラ整備の範囲を決める
- 要件: GCP（Cloud Run）上で稼働し、インフラは Terraform で管理する（`docs/requirements.md`）。Terraform は Makefile 経由でのみ操作し、prod への apply は CI のみ（CLAUDE.md）
- Google Cloud のプロジェクトは `pj-takashi-kayukawa-418609` を使い、すべてのリソースをここに作る（新しいプロジェクトは作らない）
- 現時点のアプリの制約
  - API のデータはメモリ上にあり、再起動・インスタンスの入れ替えで消える。複数インスタンスでは状態が食い違う
  - 認証は未実装で、全リクエストを開発用の固定利用者として扱う
  - AI 清書は呼び出すたびに費用が発生する。認証なしで公開すると、誰でも費用を発生させられる
- Web は Service Worker・OPFS を使うため HTTPS（安全なコンテキスト）で配信する必要がある。Web は `/api` を同一オリジンで呼ぶ前提で作られている（開発時は Vite の proxy）

## 決定

### プロジェクトと環境

1. すべてのリソースを `pj-takashi-kayukawa-418609` に作る。環境（stage）はリソース名の接尾辞 `-${stage}` で区別する（`${service_name}-<用途>-${stage}`）
2. まず **dev 環境だけ** を作る。prod 環境は認証の実装後に作る。prod も同じプロジェクトに置く可能性が高い（その場合も環境はリソース名の接尾辞で区別する）
3. リージョンは **`asia-northeast1`（東京）**。Vertex AI の呼び出しだけは `global` エンドポイント（ADR 0008）

### 配信構成

4. **Web と API を 1 つのコンテナにまとめ、1 つの Cloud Run サービスで配信する**
   - API サーバー（Hono）が `/api/*` を処理し、それ以外は Web のビルド成果物（`apps/web/dist`）を静的配信する
   - 同一オリジンになるため CORS が不要で、Service Worker・OPFS の前提（HTTPS）も `*.run.app` の URL で満たせる
   - 静的配信は導入済みの `@hono/node-server` の `serveStatic` を使い、新しいパッケージは追加しない
5. コンテナは Node.js の公式イメージ（`.node-version` と同じ版、digest でピン留め）を元にしたマルチステージビルドとし、`docker/` に置く。API は今と同じく Node.js の型注釈除去で実行する
6. 独自ドメインは当面使わず、Cloud Run の既定の URL を使う

### 認証の実装までのアクセス制限

7. **Cloud Run は未認証の呼び出しを許可しない**（`allUsers` に `roles/run.invoker` を付けない）。呼び出し権限は開発者のアカウントにだけ付ける
   - ブラウザでの確認は `gcloud run services proxy` でローカルに中継して行う（開発者の認証情報で呼び出す）
   - これにより、認証なしの API と AI 清書が外部から使われることを防ぐ
8. dev 環境のコンテナでは `NODE_ENV=production` を設定しない（開発用利用者のガードを維持する）。prod 環境は認証の実装まで作らない
9. **最大インスタンス数を 1、最小を 0** とする。メモリ保存の間は複数インスタンスで状態が食い違うため。永続化の完了後に見直す

### サービスアカウントと権限

10. Cloud Run の実行用サービスアカウントを専用に作り、必要な権限だけを付ける
    - Vertex AI の呼び出し: `roles/aiplatform.user`
    - Cloud SQL（永続化の段階で追加）: `roles/cloudsql.client`、`roles/cloudsql.instanceUser`
11. Vertex AI の Model Garden で Claude を使えるようにする操作（利用規約への同意を伴う）は Terraform で管理できないため、**手動の例外** として手順を `docs/developer/` に記録する。API（`aiplatform.googleapis.com`）の有効化は Terraform で行う

### Terraform

12. 構成は CLAUDE.md のとおり `terraform/`（ルートモジュール）、`terraform/modules/gcp/<name>/main.tf`、`terraform/tfvars/<stage>.tfvars`・`<stage>.backend.tfvars` とする
13. state は **Cloud Storage のバケット**（オブジェクトのバージョン管理・均一なアクセス制御・公開アクセスの防止を有効）に置く。バケットは Terraform 自身では作れないため、`make tf-bootstrap`（何度実行しても同じ結果になる gcloud コマンド）で作る
14. Terraform 本体・google provider・tflint（google ルールセット）のバージョンは厳密にピン留めし、リリースから 7 日以上経過した版を使う。`.terraform.lock.hcl` はコミットする
15. コンテナイメージは Artifact Registry に置き、古いイメージはクリーンアップポリシーで自動削除する（直近の数個を残す）

### デプロイ（CI）

16. GitHub Actions から Google Cloud への認証は **Workload Identity Federation** とし、サービスアカウントキーは発行しない
    - 信頼する対象をこのリポジトリと `main` / `production` ブランチの push に限定する
    - デプロイ用のサービスアカウントは実行用とは分ける
17. PR では `make tf-check`（fmt・validate・tflint）だけを実行し、Google Cloud の認証情報は使わない
18. `main` への push で、イメージのビルド・push（タグはコミット SHA）→ `make ci-tf-apply STAGE=dev`（イメージのタグを変数で渡す）を実行する。イメージの更新も Terraform で行い、`gcloud run deploy` は使わない（状態の二重管理を避ける）
19. 最初の 1 回（Workload Identity Federation 自体の作成）は、開発者が `make tf-apply STAGE=dev` で行う

### Cloud SQL（永続化の段階で作る）

20. Cloud SQL は費用が常時発生するため、インフラ整備の段階では作らず、永続化の最初の PR で作る。構成の方針は次のとおり
    - Enterprise エディション、共有コア（`db-f1-micro`）、高可用性なし、SSD 10 GB（自動増加あり）、自動バックアップ 7 日、削除保護あり
    - 接続は **Cloud SQL Node.js Connector + IAM データベース認証**（実行用サービスアカウントで DB にログインする）。パスワードを持たないため、接続情報のための Secret Manager は不要になる（ADR 0003 の「接続情報は Secret Manager から取得」を置き換える）
    - パブリック IP は持つが承認済みネットワークは空とし、Connector 経由（IAM で認可・TLS）でのみ接続する。VPC・プライベート IP は費用と構成の手間に見合わないため使わない

## 検討した代替案

| 案                                                          | 不採用理由                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Web を Cloud Storage + 外部ロードバランサ（CDN）で配信      | ロードバランサに常時費用がかかる。別オリジンになり CORS や Cookie の設計が増える                              |
| Web を Firebase Hosting で配信し `/api` を Cloud Run へ転送 | 有力（認証で Firebase Auth を選ぶ場合は相性が良い）。ただし配信先が 2 つになり、現時点では 1 コンテナで足りる |
| 認証の実装まで Cloud Run を公開（`allUsers`）               | 認証なしの API と AI 清書が誰でも使え、データの閲覧や費用の発生を防げない                                     |
| CI で `gcloud run deploy` によりイメージを更新              | Terraform の state と実体がずれる（`ignore_changes` が必要になる）。apply に一本化する                        |
| サービスアカウントキーを GitHub の Secrets に保存           | 長期の認証情報が漏洩しうる。Workload Identity Federation で不要にできる                                       |
| Cloud SQL をプライベート IP（VPC）で接続                    | VPC・Private Service Access の構成が増える。Connector + IAM 認証で、パスワードなし・TLS・IAM 認可を満たせる   |
| 環境ごとに別プロジェクト                                    | 指定のプロジェクトにすべてのリソースを作る方針のため。権限・課金の分離が必要になったら再検討する              |

## 結果

- 良い点: 配信先が 1 つで、ローカルの開発（Vite の proxy）と同じ同一オリジンの構成のまま動く
- 良い点: 長期の認証情報（サービスアカウントキー・DB パスワード）を持たない
- 良い点: 認証の実装までは外部から呼び出せないため、データと費用が守られる
- 悪い点: 静的ファイルも Cloud Run（Node.js）が返すため、CDN より遅い。個人用途では問題にならない想定
- 悪い点: 永続化までは、インスタンスが 0 に縮退するたびにデータが消える。クライアントは epoch の変化を検知してローカルのタスクも消す（ADR 0006）ため、**dev 環境で入力したタスクは消えうる**。永続化で解消する
- 悪い点: dev と prod が同じプロジェクトに同居するため、IAM の付与はリソース単位で行い、プロジェクト単位の強い権限を避ける必要がある
- 留意点: Model Garden での Claude の有効化だけは手動の例外になる

## 費用の目安（要確認）

公式の料金ページの内容を取得できなかったため、以下は第三者の情報と一般的な知識による **目安** である。確定前に Google Cloud の公式料金ページと料金計算ツールで確認する。

| リソース                                | 目安                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Cloud Run（最小 0、個人利用）           | 無料枠の範囲に収まる見込み（無料枠の現在の値は要確認）                          |
| Artifact Registry                       | イメージ数個で月数十円程度の見込み（クリーンアップで抑える）                    |
| Cloud Storage（state）                  | ほぼ 0                                                                          |
| Cloud SQL `db-f1-micro`（永続化の段階） | 月 10〜15 USD 程度 + ストレージ（第三者サイトの値。東京リージョンの値は要確認） |
| Vertex AI（Claude Haiku 5.5）           | 呼び出し回数に比例。1 日 50 回の上限あり。単価は要確認                          |

- 共有コアの Cloud SQL は SLA の対象外とされている（要確認）。個人用途として許容する
- 予算アラート（Cloud Billing の予算）は当面設定しない（2026-10-13 時点の判断）。費用が想定を超える構成（Cloud SQL など）を追加する際に再検討する

## 要確認事項

- Cloud SQL・Cloud Run・Artifact Registry・Vertex AI（Claude）の現在の料金と無料枠
- Vertex AI 上の Claude のデータの取り扱い（ADR 0008 の留意点）
- `asia-northeast1` で `db-f1-micro` が選べるか、`global` エンドポイントで Claude Haiku 5.5 が使えるか
- Cloud SQL Node.js Connector の IAM 認証と、Node.js の型注釈除去での実行の組み合わせ（永続化の段階で検証）
