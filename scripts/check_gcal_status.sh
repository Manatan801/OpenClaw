#!/bin/bash

# Configuration
CONTAINER="openclaw-gateway"
TOOLS_PY="/usr/lib/python3/dist-packages/oauth2client/tools.py"
CONFIG_DIR="/home/node/.openclaw"

echo "=== Misa Calendar Verification Tool ==="

# 1. Check if Container is running
if ! docker ps | grep -q "$CONTAINER"; then
    echo "❌ Error: Container '$CONTAINER' is not running."
    exit 1
fi
echo "✅ Container is running."

# 2. Check if Patches are applied
echo "Checking Python library patches..."
BIND_CHECK=$(docker compose exec "$CONTAINER" grep "0.0.0.0" "$TOOLS_PY" 2>/dev/null)
HOST_CHECK=$(docker compose exec "$CONTAINER" grep "'localhost'" "$TOOLS_PY" 2>/dev/null)

if [ -z "$BIND_CHECK" ]; then
    echo "❌ Patch 1 (Bind 0.0.0.0) MISSING. Run 'CALENDAR_SETUP.md' Step 3."
else
    echo "✅ Patch 1 (Bind 0.0.0.0) applied."
fi

if [ -z "$HOST_CHECK" ]; then
    echo "❌ Patch 2 (Localhost URI) MISSING. Run 'CALENDAR_SETUP.md' Step 3."
else
    echo "✅ Patch 2 (Localhost URI) applied."
fi

# 3. Check for Token existence
echo "Checking for authentication token..."
TOKEN_CHECK=$(docker compose exec "$CONTAINER" ls "$CONFIG_DIR/oauth" 2>/dev/null)

if [ -z "$TOKEN_CHECK" ]; then
    echo "❌ Auth Token NOT FOUND in $CONFIG_DIR. Need to authenticate."
else
    echo "✅ Auth Token found."
fi

# 4. Dry Run
echo "Attempting dry-run list..."
if docker compose exec "$CONTAINER" gcalcli --config-folder "$CONFIG_DIR" list > /dev/null 2>&1; then
    echo "✅ gcalcli is working correctly!"
else
    echo "❌ gcalcli command FAILED. Check credentials or token expiration."
fi
