---
name: research-report
description: Research a specific topic using DuckDuckGo and send a detailed Markdown report to Discord.
metadata:
  openclaw:
    emoji: 🕵️
    requires:
      python_packages: ["duckduckgo-search", "requests", "python-dotenv"]
---

# Research Report

Use this skill when the user asks you to "research" a topic deeply or "find news about" something, and providing a simple chat answer isn't enough. The report will be generated as a Markdown file and sent to the configured Discord channel.

## Usage

```bash
python3 scripts/research.py "Your Research Topic"
```

## When to use

- "MISA, research Quantum Computing for me."
- "Find the latest news about OpenAI and send it to Discord."
- "Deep dive into [Topic]."

## Output

- Generates a file: `report_[topic]_[date].md`
- Sends the file to Discord via Webhook.
