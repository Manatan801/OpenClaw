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

## Usage

### List Events
```bash
gcalcli list --no-monochrome
```

### Add Event
```bash
gcalcli add --title "Meeting" --when "Tomorrow 10am" --duration 60 --noprompt
```

### Agenda
```bash
gcalcli agenda
```
