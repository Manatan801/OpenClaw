---
name: discord-webhook
description: Send Markdown-formatted text to the configured Discord channel via Webhook. Use this for research results or long reports.
---

# Discord Webhook

Sends a message to the Discord channel defined by `DisCodeURL` in `.env`.

## Usage

```bash
./skills/discord-webhook/send.sh "Your markdown content here"
```

## When to use

- When you have a long research result or report.
- When the user specifically asks to send something to Discord.
- Content should be formatted in Markdown.
