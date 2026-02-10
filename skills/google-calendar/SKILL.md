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

### Initial Authentication

**For headless environments (VPS/SSH):**
```bash
# Use non-interactive OAuth flow
gcalcli --config-folder ~/.openclaw --noauth_local_webserver list
# Follow the URL displayed and paste the authorization code
```

**For interactive environments:**
```bash
gcalcli --config-folder ~/.openclaw list
# Browser will open automatically for authorization
```

### Verification
```bash
# Verify authentication works
gcalcli --config-folder ~/.openclaw agenda
```

**Troubleshooting:**
- If commands hang, ensure `~/.openclaw/oauth` exists with valid credentials
- For timeout issues, check network connectivity and OAuth token expiration

## IMPORTANT INSTRUCTIONS
- **DO NOT INVENT DATA**: If `gcalcli` returns no output or an error, report "No events found" or the specific error message. Do NOT create fake events like "Project Kickoff".
- **Real Data Only**: Only report events returned by the `gcalcli` command.
- **【重要】ハルシネーション禁止**:
  - コマンドの結果が空（empty）の場合、「予定はありません」と答えてください。
  - エラーが出た場合、「エラーが発生しました」と報告してください。
  - **絶対に**、「プロジェクトキックオフ」などの架空の予定を創作しないでください。


## CRITICAL
- **ALWAYS** use `--config-folder ~/.openclaw` with every `gcalcli` command.
- Without this flag, gcalcli looks for OAuth tokens in `~/.gcalcli_oauth` which does not exist, causing the command to hang and fail.
- Correct: `gcalcli --config-folder ~/.openclaw agenda`
- Wrong: `gcalcli agenda`

## Usage

### List Events
```bash
# Use timeout to prevent hanging on auth issues
timeout 10s gcalcli --config-folder ~/.openclaw list || echo "Error: gcalcli failed or timed out"
```

### Add Event
```bash
timeout 10s gcalcli --config-folder ~/.openclaw add --title "Meeting" --when "Tomorrow 10am" --duration 60 --noprompt
```

### Agenda
```bash
timeout 10s gcalcli --config-folder ~/.openclaw agenda
```

**Note:** The `timeout` command prevents indefinite hangs if OAuth credentials are missing or expired. Adjust the timeout value (default 10s) based on your needs.
