---
name: google-calendar
description: Manage Google Calendar events via gcalcli.
metadata:
  openclaw:
    emoji: 📅
    requires:
      bins: ["gcalcli"]
    install:
      - id: gcalcli-install
        kind: exec
        command: "apt-get update && apt-get install -y gcalcli || (apt-get install -y python3-pip && pip3 install gcalcli --break-system-packages)"
        label: Install gcalcli
---

# Google Calendar

Use `gcalcli` to manage calendar.

## Setup
Run `gcalcli list` to trigger authentication.
If it provides a URL, use the `browser` tool to visit it and authorize.

## IMPORTANT INSTRUCTIONS
- **DO NOT INVENT DATA**: If `gcalcli` returns no output or an error, report "No events found" or the specific error message. Do NOT create fake events like "Project Kickoff".
- **Real Data Only**: Only report events returned by the `gcalcli` command.
- **【重要】ハルシネーション禁止**:
  - コマンドの結果が空（empty）の場合、「予定はありません」と答えてください。
  - エラーが出た場合、「エラーが発生しました」と報告してください。
  - **絶対に**、「プロジェクトキックオフ」などの架空の予定を創作しないでください。


## Usage

### List Events
```bash
gcalcli --config-folder ~/.openclaw list
```

### Add Event
```bash
gcalcli --config-folder ~/.openclaw add --title "Meeting" --when "Tomorrow 10am" --duration 60 --noprompt
```

### Agenda
```bash
gcalcli --config-folder ~/.openclaw agenda
```
