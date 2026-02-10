# OpenClaw Gateway 運用マニュアル

VPS/サーバー環境でのOpenClaw Gateway運用における日常的な操作コマンド集です。

## 目次

- [Gateway の操作](#gateway-の操作)
- [セッション管理](#セッション管理)
- [開発環境での実行](#開発環境での実行)
- [トラブルシューティング](#トラブルシューティング)

---

## Gateway の操作

### ステータス確認

```bash
# プロセス確認
ps aux | grep openclaw-gateway | grep -v grep

# ポート待機確認
ss -ltnp | grep 18789

# リスニング状態の詳細確認
netstat -tulpn | grep 18789
```

### 再起動

#### 標準的な再起動方法

```bash
# ステップ1: 既存プロセスを停止
pkill -9 -f openclaw-gateway

# ステップ2: 新しいプロセスを起動
nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &

# ステップ3: 起動確認
sleep 3
ps aux | grep openclaw-gateway | grep -v grep
ss -ltnp | grep 18789
```

#### ワンライナー再起動

```bash
pkill -9 -f openclaw-gateway && nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 & sleep 3 && ps aux | grep openclaw-gateway | grep -v grep
```

### ログ確認

```bash
# 最新100行
tail -100 /tmp/openclaw-gateway.log

# リアルタイム監視
tail -f /tmp/openclaw-gateway.log

# エラーのみ抽出
grep -i error /tmp/openclaw-gateway.log

# 特定時刻以降のログ（例: 21:00以降）
awk '/21:00/,0' /tmp/openclaw-gateway.log
```

### Gateway 検証

```bash
# チャンネルステータス確認
openclaw channels status

# プローブ付きステータス（実際に接続確認）
openclaw channels status --probe

# Gateway接続確認
openclaw gateway ping
```

---

## セッション管理

### セッション一覧

```bash
# 最近のセッション（更新時刻順）
ls -lht config/agents/main/sessions/*.jsonl | head -10

# セッション数カウント
ls config/agents/main/sessions/*.jsonl | wc -l

# 本日作成されたセッション
find config/agents/main/sessions/ -name "*.jsonl" -mtime 0
```

### セッション状態確認

```bash
# セッション完了状況確認
tail -1 config/agents/main/sessions/<session-id>.jsonl | jq '.message.stopReason'

# 複数セッションの一括確認
for session in config/agents/main/sessions/*.jsonl; do
  echo "=== $(basename $session) ==="
  tail -1 "$session" | jq -r '.message.stopReason // .message.role // "unknown"'
done | head -30
```

### セッション内容確認

```bash
# セッションの最後3件のイベント
tail -3 config/agents/main/sessions/<session-id>.jsonl | jq -c '{event: .event, type: .type, timestamp: .timestamp}'

# セッション内のエラー検索
jq 'select(.message.isError == true)' config/agents/main/sessions/<session-id>.jsonl

# セッションの作成・更新時刻
stat config/agents/main/sessions/<session-id>.jsonl
```

### セッションクリーンアップ

```bash
# 7日以上前のセッションファイルを削除
find config/agents/main/sessions/ -name "*.jsonl" -mtime +7 -delete

# 30日以上前のセッションファイルを削除（実行前に確認）
find config/agents/main/sessions/ -name "*.jsonl" -mtime +30 -ls
find config/agents/main/sessions/ -name "*.jsonl" -mtime +30 -delete

# 完了済みセッションのアーカイブ
mkdir -p archive/sessions/$(date +%Y-%m)
find config/agents/main/sessions/ -name "*.jsonl" -mtime +7 -exec mv {} archive/sessions/$(date +%Y-%m)/ \;
```

---

## 開発環境での実行

リポジトリのルートディレクトリから実行する場合：

### pnpm 経由

```bash
# 基本形式
pnpm openclaw <コマンド>

# 例: チャンネルステータス
pnpm openclaw channels status

# 例: エージェント実行
pnpm openclaw agent --message "こんにちは"

# 例: 設定確認
pnpm openclaw config get

# 例: Gateway起動
pnpm openclaw gateway run --bind loopback --port 18789
```

### dist/ から直接実行

```bash
# ビルド実行
pnpm build

# ビルド後のバイナリから実行
node dist/index.js <コマンド>
```

---

## トラブルシューティング

### Gateway が起動しない

```bash
# 1. ポートの使用状況確認
ss -ltnp | grep 18789
lsof -i :18789

# 2. 既存プロセスの完全停止
pkill -9 -f openclaw-gateway
ps aux | grep openclaw

# 3. ログファイルのエラー確認
tail -100 /tmp/openclaw-gateway.log

# 4. 設定ファイルの検証
openclaw config validate

# 5. 診断ツール実行
openclaw doctor
```

### セッションがハングしている

```bash
# 1. プロセス確認
ps aux | grep openclaw | grep -v grep

# 2. 該当セッションのログ確認
tail -50 config/agents/main/sessions/<session-id>.jsonl

# 3. 関連プロセスの確認と停止
# 例: gcalcli がハングしている場合
ps aux | grep gcalcli
pkill -9 gcalcli

# 4. Gateway再起動
pkill -9 -f openclaw-gateway
nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &
```

### チャンネル接続エラー

```bash
# 1. チャンネル設定確認
openclaw config get channels

# 2. 認証トークン確認
openclaw config get telegram.token
openclaw config get discord.token

# 3. ネットワーク接続確認
curl -I https://api.telegram.org
curl -I https://discord.com/api/v10

# 4. Gateway再接続
openclaw gateway reconnect
```

### gcalcli OAuth フリーズ

VPS環境でブラウザ認証が必要な場合：

```bash
# 1. ヘッドレス認証を使用
gcalcli --config-folder ~/.openclaw --noauth_local_webserver list

# 2. 表示されたURLをブラウザで開く
# 3. 認証コードをターミナルに貼り付け

# 4. タイムアウト付きでコマンド実行
timeout 10s gcalcli --config-folder ~/.openclaw agenda

# 詳細は skills/google-calendar/SKILL.md を参照
```

### ディスク容量不足

```bash
# 1. セッションファイルのサイズ確認
du -sh config/agents/main/sessions/
du -h config/agents/main/sessions/*.jsonl | sort -h | tail -10

# 2. ログファイルのサイズ確認
du -sh /tmp/openclaw-gateway.log
du -sh ~/.openclaw/logs/

# 3. 古いファイルの削除
find config/agents/main/sessions/ -name "*.jsonl" -mtime +7 -delete
find ~/.openclaw/logs/ -name "*.log" -mtime +30 -delete

# 4. ログローテーション
mv /tmp/openclaw-gateway.log /tmp/openclaw-gateway.log.$(date +%Y%m%d)
gzip /tmp/openclaw-gateway.log.*
```

### メモリ使用量が高い

```bash
# 1. プロセスのメモリ使用状況
ps aux --sort=-%mem | grep openclaw | head -10

# 2. Gateway再起動でメモリ解放
pkill -9 -f openclaw-gateway
nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &

# 3. システム全体のメモリ確認
free -h
top -o %MEM | head -20
```

---

## 定期メンテナンス

### 日次

```bash
# ログサイズ確認
du -sh /tmp/openclaw-gateway.log

# Gateway稼働確認
ps aux | grep openclaw-gateway | grep -v grep
openclaw channels status
```

### 週次

```bash
# 古いセッションファイル削除
find config/agents/main/sessions/ -name "*.jsonl" -mtime +7 -delete

# ログローテーション
if [ -f /tmp/openclaw-gateway.log ]; then
  mv /tmp/openclaw-gateway.log /tmp/openclaw-gateway.log.$(date +%Y%m%d)
  gzip /tmp/openclaw-gateway.log.*
fi

# Gateway再起動（週次メンテナンス）
pkill -9 -f openclaw-gateway
nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &
```

### 月次

```bash
# 全セッションアーカイブ
mkdir -p archive/sessions/$(date +%Y-%m)
find config/agents/main/sessions/ -name "*.jsonl" -mtime +30 -exec mv {} archive/sessions/$(date +%Y-%m)/ \;

# 設定バックアップ
tar czf backup/config-$(date +%Y%m%d).tar.gz config/

# システム診断
openclaw doctor > diagnostics/doctor-$(date +%Y%m%d).log
```

---

## 関連ドキュメント

- [Gateway 設定](configuration.md)
- [バックグラウンドプロセス](background-process.md)
- [ヘルスチェック](health.md)
- [診断ツール](doctor.md)
- [ロギング](logging.md)
- [Google Calendar スキル](/skills/google-calendar/SKILL.md)
- [VPS セットアップガイド](../platforms/vps.md)

---

## バージョン履歴

- **2026.2.2** - 初版作成（サブエージェントフリーズ修正対応）
