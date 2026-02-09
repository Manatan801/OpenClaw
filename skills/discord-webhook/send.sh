#!/bin/bash
# send.sh - Send message to Discord Webhook
# Usage: ./send.sh "Message content"

CONTENT="$1"

if [ -z "$CONTENT" ]; then
    echo "Error: No content provided."
    exit 1
fi

# Load .env to get DisCodeURL
if [ -f "../../.env" ]; then
    export $(grep -v '^#' ../../.env | xargs)
fi

if [ -z "$DisCodeURL" ]; then
    echo "Error: DisCodeURL not found in .env"
    exit 1
fi

# Escape content for JSON using python (reliable and usually available)
ESCAPED_CONTENT=$(python3 -c "import json, sys; print(json.dumps(sys.argv[1]))" "$CONTENT")

# Construct JSON payload
# Note: ESCAPED_CONTENT already includes surrounding quotes from json.dumps
PAYLOAD="{\"content\": $ESCAPED_CONTENT}"

# Send to Discord
curl -X POST -H "Content-Type: application/json" -d "$PAYLOAD" "$DisCodeURL"
