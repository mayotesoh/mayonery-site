# CLAUDE.md — ロジカル手相学サイト 引き継ぎメモ

> このファイルは新しい Claude Code セッションが最初に読む引き継ぎ資料です。
> 2026-07-13 に `C:\Users\mayonery\mayonery-site` → `C:\Users\mayonery\占いサイト\mayonery-site` へ移動しました。

## サイト概要
- 手相「ロジカル手相学」の **Astro 静的サイト**。GitHub Pages で公開 → **mayonery.jp**
- リポジトリ: `mayotesoh/mayonery-site`（**PUBLIC**。秘密情報を絶対にコミットしない）
- コンテンツ（用語集・ブログ・クイズ）は **Notion DB をビルド時に取得**して静的化
- `main` へ push で GitHub Actions がデプロイ。**毎時00分**の cron 再ビルドも設定済み（2026-09-03 に毎日06:00から変更）（`.github/workflows/deploy.yml`）
- デプロイ手動起動: `gh workflow run deploy.yml --ref main`（`.env` の GITHUB_TOKEN は期限切れ。`gh` CLI は認証済みで使える）

## Notion の一括編集は Claude Code が直接やる（最速・確実）
- `tools/*.mjs`（Node、`fetch` で Notion REST を直叩き、`.env` からトークン読込。SDK不使用）
- トークン: `.env` の `NOTION_API_KEY`（無ければ `NOTION_API_KEY2`）。**値はここに書かない**
- Notion API は `page_size` 既定100 → **必ずページネーション**（`start_cursor`/`has_more`/`next_cursor`）
- rich_text のリンクは**絶対URL必須**（`https://mayonery.jp/...`）
- 主なスクリプト: 用語登録=`notion_import.mjs`＋`glossary_terms.mjs` / クイズ=`quiz_import.mjs` / 重複解消=`glossary_dedupe.mjs` / 関連リンク=`glossary_crosslink.mjs` / カテゴリ付与=`quiz_categorize.mjs` / 記事公開=`publish_quiz_article.mjs`
- **GAS を挟む必要はない**。Gemini 無料枠(1日20回)の制約も回避できる

### Notion DB ID（`.env`ではなくスクリプトに直書きの箇所あり）
- 用語集: `344a43543ec2805e9409e969a3f3f651`
- クイズ: `347a43543ec2805f82f2cbb58642599e`
- ブログ・記事: `347a43543ec2804d96e9dc5edd3441a5`（`.env`の値は壊れているため直指定）
- クイズDBスキーマ: 問題文(title) / 選択肢1-4(rich_text) / 正解の番号(rich_text "1"-"4") / 解説(rich_text) / カテゴリー(select)

## GAS（自動化）
- `gas/` は **.gitignore 済み**（LINEトークン直書きのため公開repoに載せない）
- Drive→用語集、SNS下書き、自動ブログ等の自動化コードは GAS 側にある
- スクリプトプロパティ設定は `gas/Config.gs` のコメント参照。X の認証情報(`X_API_KEY`等)は投入済みの見込み／Threads は開発者登録が難航中で保留

## 既知の注意点
- 用語集は `公開ステータス=下書き` の分をサイト非表示にする設計
- YouTube埋め込みは `youtube-nocookie.com/embed` ＋ iframe `allow="...encrypted-media..."`（Firefoxで「再生できません」になるのを回避）
- 動画は**ビルド時にRSS**取得（`https://www.youtube.com/feeds/videos.xml?channel_id=UC8FyvgMTWWN77utbwmtAX8w`）。クライアント側rss2jsonは使わない

## 現在の未完タスク
- **ブログ更新→SNS自動投稿**（検討中）。方針: GASのSNSパイプラインをブログDBにも拡張。まず X で「承認ゲート付き」がおすすめ。ブロッカーは Threads の開発者登録と、X の疎通テスト未実施

## メモリについて
- 過去メモは `C:\Users\mayonery\.claude\projects\C--Users-mayonery-------mayonery-site\memory\` にコピー済み（`mayonery-architecture.md` / `gemini-quota-gotcha.md`）
