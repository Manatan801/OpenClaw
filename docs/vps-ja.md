---
summary: "VPS で OpenClaw を常時稼働させるガイド（systemd）"
read_when:
  - VPS で Gateway を動かしたい
  - SSH 切断後もプロセスを維持したい
  - VPS/ホスティングガイドの一覧が必要
title: "VPS ホスティング (日本語)"
---

# VPS ホスティング

このページでは、対応する VPS/ホスティングガイドへのリンクと、クラウド環境での
OpenClaw の運用方法を解説します。

## プロバイダを選ぶ

- **Railway**（ワンクリック + ブラウザ設定）: [Railway](/railway)
- **Northflank**（ワンクリック + ブラウザ設定）: [Northflank](/northflank)
- **Oracle Cloud（Always Free）**: [Oracle](/platforms/oracle) -- $0/月（ARM、容量/登録がやや不安定）
- **Fly.io**: [Fly.io](/platforms/fly)
- **Hetzner (Docker)**: [Hetzner](/platforms/hetzner)
- **GCP (Compute Engine)**: [GCP](/platforms/gcp)
- **exe.dev**（VM + HTTPS プロキシ）: [exe.dev](/platforms/exe-dev)
- **AWS (EC2/Lightsail/無料枠)**: 問題なく動作します

## クラウド構成の仕組み

- **Gateway は VPS 上で動作**し、状態とワークスペースを管理します。
- ノートPC やスマホから**コントロール UI** または **Tailscale/SSH** で接続します。
- VPS をデータの信頼元とし、状態とワークスペースを**バックアップ**してください。
- セキュリティ: Gateway はデフォルトで loopback にバインドされます。SSH トンネルまたは Tailscale Serve 経由でアクセスしてください。`lan`/`tailnet` にバインドする場合は `gateway.auth.token` または `gateway.auth.password` を設定してください。

リモートアクセス: [Gateway リモート](/gateway/remote)
プラットフォーム一覧: [Platforms](/platforms)

## SSH 切断後も動かし続ける

SSH セッションを閉じると、フォアグラウンドのプロセスは終了します。OpenClaw には
systemd サービスの自動インストール機能が組み込まれており、Gateway をクラッシュ時
の自動再起動やマシン再起動後の自動起動に対応させることができます。

### 1. サービスをインストール

```bash
openclaw gateway install
```

または、オンボーディング時に一括で実行する場合:

```bash
openclaw onboard --install-daemon
```

これにより `~/.config/systemd/user/openclaw-gateway.service` に systemd ユーザー
サービスが作成されます。`Restart=always`（常時再起動）と `RestartSec=5`（5 秒後に
再起動）が設定済みです。

### 2. linger を有効化

systemd の**ユーザーサービス**は、デフォルトではユーザーがログアウトすると停止
します。linger を有効にすることで、SSH 切断後もサービスが維持されます:

```bash
loginctl enable-linger $(whoami)
```

root ユーザーの場合は通常すでに linger が有効ですが、実行しても問題ありません。

### 3. 動作確認

```bash
# OpenClaw のステータス確認
openclaw gateway status

# systemctl で確認
systemctl --user status openclaw-gateway.service

# リアルタイムログ
journalctl --user -u openclaw-gateway.service -f
```

SSH を**切断**してから再接続し、`openclaw gateway status` がまだ **running** と
表示されることを確認してください。

### 4. リモートアクセス

Gateway はデフォルトで loopback（127.0.0.1）にバインドされます。ノート PC から
コントロール UI にアクセスするには SSH トンネルを使います:

```bash
# ノート PC 側で実行
ssh -N -L 18789:127.0.0.1:18789 user@your-vps-ip
```

その後、ブラウザで `http://127.0.0.1:18789/` を開いてください。

常時 HTTPS アクセスが必要な場合は [Tailscale Serve](/gateway/tailscale) を参照
してください。

### サービス管理コマンド

| コマンド | 説明 |
|---------|------|
| `openclaw gateway start` | サービス開始 |
| `openclaw gateway stop` | サービス停止 |
| `openclaw gateway restart` | サービス再起動 |
| `openclaw gateway status` | 状態確認 |
| `openclaw gateway uninstall` | サービス削除 |

### systemd ユニットの詳細

`openclaw gateway install` が生成するユニットファイルの構造:

```ini
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5
Environment=OPENCLAW_GATEWAY_TOKEN=...
WorkingDirectory=/home/youruser

[Install]
WantedBy=default.target
```

システムサービス（マルチユーザー/常時稼働サーバー向け）として設定する場合は
[Gateway 運用ガイド](/gateway#supervision-systemd-user-unit) を参照してください。

### 検証チェックリスト

1. `openclaw gateway install` を実行
2. `loginctl enable-linger $(whoami)` を実行
3. `openclaw gateway status` で **running** を確認
4. SSH セッションを切断
5. 再接続後、`openclaw gateway status` でまだ **running** であることを確認

## 低メモリ VPS 向けの対策（1-2 GB）

Gateway がフリーズしたり OOM キラーに終了されたりする場合は、スワップを追加してください:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

その他のヒント:
- ローカルモデルではなく API ベースのモデル（Claude、GPT）を使用する
- `free -h` でメモリ使用量を監視する

プロバイダごとの詳細ガイド: [DigitalOcean](/platforms/digitalocean)

## VPS でノードを使う

Gateway をクラウドに置いたまま、ローカルデバイス（Mac/iOS/Android/ヘッドレス）
に**ノード**をペアリングできます。ノードはローカルの画面/カメラ/キャンバスや
`system.run` 機能を提供し、Gateway はクラウドで稼働し続けます。

ドキュメント: [ノード](/nodes)、[ノード CLI](/cli/nodes)
