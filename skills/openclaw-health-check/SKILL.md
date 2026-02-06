---
name: openclaw-health-check
description: Comprehensive health check for OpenClaw installations including configuration, security, Docker services, and logs analysis.
metadata:
  openclaw:
    emoji: 🏥
    requires:
      bins: ["docker", "git"]
---

# OpenClaw System Health Check

Perform a comprehensive health check of an OpenClaw installation to verify configuration, security, Docker services, and identify potential issues.

## Overview

This skill provides a systematic approach to checking the health of an OpenClaw deployment, covering:

1. Configuration file validation
2. Git security (exposed secrets)
3. Docker services status
4. Log analysis
5. Security vulnerabilities
6. Comprehensive reporting

## When to Use

- After initial OpenClaw installation
- After making configuration changes
- When troubleshooting issues
- Following security incidents
- Periodic system verification
- Before major updates or changes

## Workflow

### 1. Configuration Files Review

Check the following files for correctness:

#### `.env` File
```bash
cat /root/openclaw/.env
```

Verify:
- ✅ `LLM_API_KEY` and `OPENROUTER_API_KEY` match
- ✅ `TELEGRAM_BOT_TOKEN` is set (if using Telegram)
- ✅ `OPENCLAW_GATEWAY_TOKEN` is set
- ✅ `OPENCLAW_GATEWAY_MODE=local` (for local deployments)
- ⚠️ No duplicate variable definitions

#### `config/openclaw.json`
```bash
cat /root/openclaw/config/openclaw.json
```

Verify:
- ✅ Model is correctly configured (`agents.defaults.model.primary`)
- ✅ Telegram is enabled if needed (`channels.telegram.enabled`)
- ✅ Gateway mode matches environment (`gateway.mode`)

#### `config/agents/main/agent/auth-profiles.json`
```bash
cat /root/openclaw/config/agents/main/agent/auth-profiles.json
```

Verify:
- ✅ Uses environment variable placeholders (e.g., `${LLM_API_KEY}`)
- ❌ Does NOT contain hardcoded API keys

### 2. Git Security Check

Search for exposed secrets in repository:

```bash
cd /root/openclaw
grep -r "sk-or-v1-" --include="*.json" --include="*.md" --include="*.sh" --include="*.yml" --include="*.yaml" . || echo "No exposed keys found"
```

Check `.gitignore`:
```bash
cat .gitignore | grep -E "(\.env|auth-profiles\.json)"
```

Required entries:
- `.env`
- `.env.save`
- `config/agents/main/agent/auth-profiles.json`

### 3. Docker Services Status

Check running containers:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected containers:
- `openclaw-openclaw-gateway-1` (Up)
- `openclaw-openclaw-cli-1` (Up)

### 4. Log Analysis

Check gateway logs for errors:
```bash
docker logs openclaw-openclaw-gateway-1 --tail 50
```

Look for:
- ✅ `[gateway] agent model: openrouter/...` (model loaded)
- ✅ `[gateway] listening on ws://127.0.0.1:18789` (gateway running)
- ✅ `[telegram] starting provider` (if using Telegram)
- ❌ Any ERROR or FAIL messages

Filter for warnings/errors:
```bash
docker logs openclaw-openclaw-gateway-1 2>&1 | grep -i -E "(error|fail|warn)" | tail -20
```

### 5. Security Vulnerabilities Check

#### Check for exposed credentials
```bash
# Check if .env files are tracked by git
git ls-files | grep -E "(\.env|auth-profiles\.json)"
```

Expected: No output (files should be ignored)

#### Verify local-only binding
```bash
docker ps --format "{{.Ports}}" | grep -E "0\.0\.0\.0|:::"
```

Expected: No output. Ports should bind to `127.0.0.1` only for security.

#### Check uncommitted sensitive changes
```bash
git status --short | grep -E "(\.env|auth-profiles)"
```

### 6. Generate Health Report

Create a comprehensive report including:

- **Configuration Status**: All config files valid
- **Model Configuration**: Currently active model
- **API Keys**: Status (not exposed)
- **Docker Services**: Container status and uptime
- **Telegram Connection**: Bot status
- **Security**: Git ignore status, no exposed secrets
- **Logs**: Recent errors or warnings
- **Recommendations**: Any suggested improvements

## Quick Health Check Commands

For a rapid check, run these commands in sequence:

```bash
# 1. Check services
docker ps

# 2. Check model and gateway
docker logs openclaw-openclaw-gateway-1 --tail 20 | grep -E "(model|listening|telegram)"

# 3. Check for errors
docker logs openclaw-openclaw-gateway-1 2>&1 | grep -i error | tail -10

# 4. Verify security
git status --short | grep -v "^??" | grep -E "(\.env|auth-profiles)" && echo "⚠️ Sensitive files tracked!" || echo "✅ Security OK"
```

## Common Issues and Remediation

### Issue: API Key Mismatch
**Symptom**: `LLM_API_KEY` and `OPENROUTER_API_KEY` differ
**Fix**:
```bash
# Edit .env to make them match
nano /root/openclaw/.env
# Restart services
docker compose down && docker compose up -d
```

### Issue: Hardcoded API Key in auth-profiles.json
**Symptom**: Actual key visible in JSON file
**Fix**:
```bash
# Replace with placeholder
echo '{"openai": {"apiKey": "${LLM_API_KEY}", "apiBaseUrl": "https://openrouter.ai/api/v1"}}' > /root/openclaw/config/agents/main/agent/auth-profiles.json
# Add to gitignore
echo "config/agents/main/agent/auth-profiles.json" >> .gitignore
# Remove from git tracking
git rm --cached config/agents/main/agent/auth-profiles.json
git commit -m "Security: Remove auth-profiles from tracking"
```

### Issue: Container Not Running
**Symptom**: `docker ps` shows container as stopped
**Fix**:
```bash
# Check logs for errors
docker logs openclaw-openclaw-gateway-1 --tail 50
# Restart services
docker compose down && docker compose up -d
```

### Issue: Model Not Loading
**Symptom**: Logs show model errors or API failures
**Fix**:
1. Verify API key is valid at https://openrouter.ai/keys
2. Check `.env` has correct key
3. Verify `config/openclaw.json` model format is `openrouter/provider/model`
4. Restart: `docker compose restart openclaw-gateway`

## Best Practices

1. **Run health checks**:
   - After initial setup
   - After changing models or configuration
   - Weekly for production deployments
   - After any security incidents

2. **Keep configurations in sync**:
   - Model name in `openclaw.json` is the source of truth
   - API keys in `.env` only
   - Never commit `.env` or `auth-profiles.json`

3. **Monitor logs regularly**:
   - Check for connection issues
   - Verify model API responses
   - Look for rate limiting or quota warnings

4. **Security hygiene**:
   - Rotate API keys periodically
   - Review `.gitignore` before pushing
   - Use `git status` to check for tracked secrets
   - Bind services to `127.0.0.1` (not `0.0.0.0`)

## Output Format

The health check should produce a report in markdown format with:

```markdown
# OpenClaw System Health Report

**Date**: YYYY-MM-DD HH:MM
**Status**: ✅ Healthy / ⚠️ Warning / ❌ Critical

## Summary
[Table of component statuses]

## Configuration
[Details of config files]

## Docker Services
[Container status and logs]

## Security
[Gitignore status, exposed secrets check]

## Recommendations
[Any suggested improvements]
```

## Related Skills

- `healthcheck`: Host-level security hardening (OS, firewall, SSH)
- `model-usage`: Track and analyze model usage and costs
- `session-logs`: Review assistant session logs

## Notes

- This skill focuses on OpenClaw-specific health checks
- For OS-level hardening, use the `healthcheck` skill
- Always restart Docker services after configuration changes
- Keep API keys and tokens in `.env` only, never in code
