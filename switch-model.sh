#!/bin/bash
# OpenRouter Model Switcher for OpenClaw
# Usage: ./switch-model.sh [model-name]

CONFIG_DIR="./config"
OPENCLAW_CONFIG="$CONFIG_DIR/openclaw.json"

# OpenRouter models (format: openrouter/provider/model)
MODELS=(
    "openrouter/anthropic/claude-opus-4"
    "openrouter/anthropic/claude-sonnet-4"
    "openrouter/anthropic/claude-3.5-sonnet"
    "openrouter/anthropic/claude-3-haiku"
    "openrouter/openai/gpt-4o"
    "openrouter/openai/gpt-4o-mini"
    "openrouter/openai/gpt-4-turbo"
    "openrouter/openai/o1-preview"
    "openrouter/openai/o1-mini"
    "openrouter/google/gemini-2.0-flash-001"
    "openrouter/google/gemini-pro-1.5"
    "openrouter/google/gemini-flash-1.5"
    "openrouter/deepseek/deepseek-chat"
    "openrouter/deepseek/deepseek-r1"
    "openrouter/deepseek/deepseek-v3.2"
    "openrouter/meta-llama/llama-3.3-70b-instruct"
    "openrouter/meta-llama/llama-3.1-405b-instruct"
    "openrouter/mistralai/mistral-large"
    "openrouter/mistralai/mixtral-8x22b-instruct"
    "openrouter/qwen/qwen-2.5-72b-instruct"
    "openrouter/cohere/command-r-plus"
    "openrouter/openai/o3-deep-research"
)

show_menu() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║      OpenRouter Model Switcher for OpenClaw            ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    echo "Available models:"
    echo ""
    for i in "${!MODELS[@]}"; do
        # Display without "openrouter/" prefix for readability
        display_name=$(echo "${MODELS[$i]}" | sed 's/openrouter\///')
        printf "  %2d) %s\n" $((i+1)) "$display_name"
    done
    echo ""
    echo "  0) Enter custom model name"
    echo "  q) Quit"
    echo ""
}

update_config() {
    local model=$1
    
    # Create config with model using heredoc (jq not always available)
    cat > "$OPENCLAW_CONFIG" << EOF
{
  "commands": {
    "native": "auto",
    "nativeSkills": "auto"
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "pairing",
      "groupPolicy": "allowlist",
      "streamMode": "partial"
    }
  },
  "gateway": {
    "mode": "local"
  },
  "agents": {
    "defaults": {
      "maxConcurrent": 4,
      "model": {
        "primary": "$model"
      },
      "subagents": {
        "maxConcurrent": 8
      }
    }
  },
  "messages": {
    "ackReactionScope": "group-mentions"
  },
  "plugins": {
    "entries": {
      "telegram": {
        "enabled": true
      }
    }
  }
}
EOF
    
    chmod 666 "$OPENCLAW_CONFIG"
    
    echo ""
    echo "✅ Model set to: $model"
    echo ""
    echo "Restarting gateway..."
    docker compose down && docker compose up -d
    sleep 10
    
    # Verify the change
    echo ""
    echo "Checking new model..."
    docker logs openclaw-openclaw-gateway-1 --tail 10 | grep -E "(agent model|listening)"
    echo ""
    echo "Done! Try sending a message to your Telegram bot."
}

# If argument provided, use it directly
if [ -n "$1" ]; then
    # Add openrouter/ prefix if not present
    if [[ ! "$1" =~ ^openrouter/ ]]; then
        update_config "openrouter/$1"
    else
        update_config "$1"
    fi
    exit 0
fi

# Interactive mode
while true; do
    show_menu
    read -p "Select model number (or 'q' to quit): " choice
    
    case $choice in
        q|Q)
            echo "Bye!"
            exit 0
            ;;
        0)
            read -p "Enter model name (e.g., anthropic/claude-sonnet-4): " custom_model
            if [ -n "$custom_model" ]; then
                # Add openrouter/ prefix if not present
                if [[ ! "$custom_model" =~ ^openrouter/ ]]; then
                    update_config "openrouter/$custom_model"
                else
                    update_config "$custom_model"
                fi
                exit 0
            fi
            ;;
        [1-9]|[1-9][0-9])
            idx=$((choice-1))
            if [ $idx -ge 0 ] && [ $idx -lt ${#MODELS[@]} ]; then
                update_config "${MODELS[$idx]}"
                exit 0
            else
                echo "Invalid selection. Please try again."
            fi
            ;;
        *)
            echo "Invalid input. Please try again."
            ;;
    esac
done
