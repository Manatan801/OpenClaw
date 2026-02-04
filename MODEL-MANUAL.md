# OpenClaw モデル切り替えマニュアル

## 概要

このスクリプトを使って、OpenClaw の AI モデルを簡単に切り替えることができます。
OpenRouter 経由で様々なモデルを利用できます。

---

## 基本的な使い方

### 1. インタラクティブモード（メニューから選択）

```bash
cd /root/openclaw
./switch-model.sh
```

実行すると以下のようなメニューが表示されます：

```
╔════════════════════════════════════════════════════════╗
║      OpenRouter Model Switcher for OpenClaw            ║
╚════════════════════════════════════════════════════════╝

Available models:

   1) anthropic/claude-opus-4
   2) anthropic/claude-sonnet-4
   3) anthropic/claude-3.5-sonnet
   ...

Select model number (or 'q' to quit):
```

**番号を入力してEnter** を押すだけでモデルが切り替わります。

---

### 2. 直接指定モード（コマンドライン）

```bash
./switch-model.sh モデル名
```

例：
```bash
./switch-model.sh openai/gpt-4o-mini
./switch-model.sh anthropic/claude-sonnet-4
./switch-model.sh deepseek/deepseek-chat
```

---

## 利用可能なモデル一覧

| 番号 | モデル名 | 特徴 |
|:----:|----------|------|
| 1 | `anthropic/claude-opus-4` | 最高性能、複雑なタスク向け |
| 2 | `anthropic/claude-sonnet-4` | バランス型、おすすめ |
| 3 | `anthropic/claude-3.5-sonnet` | 実績あり、安定 |
| 4 | `anthropic/claude-3-haiku` | 高速、軽いタスク向け |
| 5 | `openai/gpt-4o` | OpenAI最新、高性能 |
| 6 | `openai/gpt-4o-mini` | 軽量で速い、コスパ◎ |
| 7 | `openai/gpt-4-turbo` | 大容量コンテキスト |
| 8 | `openai/o1-preview` | 推論特化 |
| 9 | `openai/o1-mini` | 推論特化（軽量） |
| 10 | `google/gemini-2.0-flash-001` | Google最新 |
| 11 | `google/gemini-pro-1.5` | 高性能 |
| 12 | `google/gemini-flash-1.5` | 高速 |
| 13 | `deepseek/deepseek-chat` | コスパ最強 |
| 14 | `deepseek/deepseek-r1` | 推論特化 |
| 15 | `meta-llama/llama-3.3-70b-instruct` | オープンソース |
| 16 | `meta-llama/llama-3.1-405b-instruct` | 最大規模OSS |
| 17 | `mistralai/mistral-large` | 欧州製 |
| 18 | `mistralai/mixtral-8x22b-instruct` | MoE構造 |
| 19 | `qwen/qwen-2.5-72b-instruct` | 中国製、多言語 |
| 20 | `cohere/command-r-plus` | RAG向け |

---

## カスタムモデルの指定

メニューで `0` を選択すると、リストにないモデルも指定できます。

OpenRouter で利用可能なモデル一覧：  
https://openrouter.ai/models

---

## トラブルシューティング

### モデル変更後にエラーが出る場合

```bash
# ログを確認
docker logs openclaw-openclaw-gateway-1 --tail 30

# 手動で再起動
docker compose restart openclaw-gateway
```

### 現在のモデルを確認

```bash
cat ./config/agents/main/agent/agent.json
```

---

## クイックリファレンス

| やりたいこと | コマンド |
|-------------|---------|
| メニューから選択 | `./switch-model.sh` |
| GPT-4o-mini に変更 | `./switch-model.sh openai/gpt-4o-mini` |
| Claude Sonnet に変更 | `./switch-model.sh anthropic/claude-sonnet-4` |
| DeepSeek に変更 | `./switch-model.sh deepseek/deepseek-chat` |
| 現在のモデル確認 | `cat ./config/agents/main/agent/agent.json` |
| ログ確認 | `docker logs openclaw-openclaw-gateway-1 --tail 30` |
