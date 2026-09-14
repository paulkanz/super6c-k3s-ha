#!/usr/bin/env bash
# ==============================================================================
# Script: copy-headlamp-token.sh
# Purpose: Retrieve Headlamp admin RBAC token and copy directly to clipboard buffer
# ==============================================================================
set -euo pipefail

# Determine kubeconfig path
KUBECONFIG_PATH="${KUBECONFIG:-${HOME}/.kube/config-super6c-edge}"

if [[ ! -f "${KUBECONFIG_PATH}" ]]; then
  if [[ -f "${HOME}/.kube/config" ]]; then
    KUBECONFIG_PATH="${HOME}/.kube/config"
  else
    echo "❌ Error: Kubeconfig file not found at ${KUBECONFIG_PATH}" >&2
    echo "   Ensure ~/.kube/config-super6c-edge exists or set KUBECONFIG." >&2
    exit 1
  fi
fi

# Check for kubectl
if ! command -v kubectl >/dev/null 2>&1; then
  echo "❌ Error: 'kubectl' command not found in PATH." >&2
  exit 1
fi

# Fetch and decode the token
echo "🔑 Fetching Headlamp admin token from cluster..."
TOKEN=$(kubectl --kubeconfig "${KUBECONFIG_PATH}" get secret headlamp-admin-token -n headlamp -o jsonpath='{.data.token}' 2>/dev/null | base64 -d)

if [[ -z "${TOKEN}" ]]; then
  echo "❌ Error: Unable to retrieve token from Secret 'headlamp-admin-token' in namespace 'headlamp'." >&2
  exit 1
fi

# Copy to clipboard using pbcopy (with fallback for Linux environments)
if command -v pbcopy >/dev/null 2>&1; then
  printf "%s" "${TOKEN}" | pbcopy
  CLIP_TOOL="pbcopy (macOS)"
elif command -v wl-copy >/dev/null 2>&1; then
  printf "%s" "${TOKEN}" | wl-copy
  CLIP_TOOL="wl-copy (Wayland)"
elif command -v xclip >/dev/null 2>&1; then
  printf "%s" "${TOKEN}" | xclip -selection clipboard
  CLIP_TOOL="xclip (X11)"
else
  echo "⚠️  Warning: No clipboard utility (pbcopy/wl-copy/xclip) found."
  CLIP_TOOL="none"
fi

# Display summary and access instructions
echo "✅ Headlamp admin token copied to clipboard buffer via ${CLIP_TOOL}!"
echo ""
echo "   Token preview: ${TOKEN:0:18}...${TOKEN: -18}"
echo ""
echo "👉 Simply press Cmd+V to paste into the Headlamp token login screen:"
echo "   • Local VIP (Port 8081): http://192.168.1.130:8081/headlamp/c/main/token"
echo "   • Local VIP (Port 80):   http://192.168.1.130/headlamp/c/main/token"
echo "   • Domain (SSL):         https://${HEADLAMP_DOMAIN:-headlamp.example.com}/headlamp/c/main/token"
echo ""
