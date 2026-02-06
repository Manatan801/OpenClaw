---
name: obsidian
description: Semantic Knowledge Base Engine using OpenAI Embeddings.
homepage: https://help.obsidian.md
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "requires": { "bins": ["python3"] },
      },
  }
---

# Semantic Knowledge Base (KB Engine)

MISA's "Second Brain" is managed by a custom Python semantic engine (`kb_engine.py`).
It uses OpenAI Embeddings to find relevant information even if keywords don't match exactly.

## Commands

### 1. Build Index (Maintenance)
Run this occasionally to update the search index (e.g. after manual edits).
```bash
python3 /app/scripts/kb_engine.py build
```

### 2. Search (Semantic)
Find information by "meaning".
```bash
python3 /app/scripts/kb_engine.py search "How do I add a calendar event?"
```

### 3. Store (Create/Update Note)
Save a new note and immediately index it.
```bash
# Store a quick note
python3 /app/scripts/kb_engine.py store "00_Inbox/Idea.md" "# My Idea\nThis is a great idea."
```

## Usage Protocol

### Directory Standard (PARA)
- `00_Inbox/`: New/Unsorted items.
- `10_Journal/Daily/`: Daily notes `YYYY-MM-DD.md`.
- `20_Projects/`: Active goals.
- `30_Areas/`: Ongoing areas (Health, Finance).
- `40_Resources/`: Manuals, Specs (Read-Only).

### Workflow
1. **Search First**: Before answering, ALWAYS search the KB.
   - `python3 /app/scripts/kb_engine.py search "context"`
2. **Log Insights**: If the user shares something important, store it.
   - `python3 /app/scripts/kb_engine.py store "10_Journal/Interactions/YYYY-MM-DD_Topic.md" "..."`
