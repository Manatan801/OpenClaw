# Misa (ClawdBot) ユーザーガイド

このドキュメントは、OpenClaw 上で稼働するパーソナルAIパートナー「Misa」のセットアップおよび利用方法をまとめたものです。

## ✨ 実装された機能

1.  **Brain (Persona)**: Misa の性格（Proactive, Supportive）をシステムの中核（`SOUL.md`）に統合しました。
2.  **Sensory (Calendar)**: `gcalcli` を使用した Google Calendar 管理機能（Skill: `google-calendar`）。
3.  **Actuator (Morning Briefing)**: 毎朝 06:00 に天気・予定・ニュースを配信するモーニングブリーフィング。
4.  **Actuator (Notification)**: Telegram 通知機能。
5.  **Second Brain (Obsidian)**: PARAメソッドに基づき知識を管理する「Insight Engine」機能。

## 🚀 利用方法と確認

### 1. ペルソナの確認 (Persona Check)
Misa は親しみやすく、肯定的な口調（「〜だね」「任せて！」）で話します。
- **試してみる**: 「挨拶して」と話しかけてみてください。

### 2. カレンダー連携 (Google Calendar)
スケジュールの確認や追加が可能です。
- **試してみる**: 「今日の予定は？」
- **注意**: 初回利用時に、Google 認証用の URL が表示されます。ブラウザで開いて認証を行ってください。

### 3. Webリサーチ (Web Research)
ブラウザ機能を使ってリアルタイムな情報を検索します。
- **試してみる**: 「最近のAIニュースを教えて」

### 4. 第二の脳 (Second Brain / Obsidian)
`openclaw/workspace/knowledge_base` ディレクトリでノートを管理します。
- **試してみる**: 「今日の振り返りをしたい」
- **確認**: `knowledge_base/10_Journal/Daily/` に日報が作成・更新されているか確認してください。

## ⚙️ セットアップ要件

すべての機能を有効にするために、以下の設定を行ってください。

1.  **Telegram**: `.env` ファイルに `TELEGRAM_BOT_TOKEN` を設定すると、スマートフォンでモーニングブリーフィングを受け取れます。
2.  **Google Calendar**: 初回利用時の認証（ブラウザでの許可）が必要です。
3.  **Obsidian**: ローカルの Obsidian Vault と同期したい場合、`knowledge_base` ディレクトリを Vault として開くか、同期設定を行ってください。
