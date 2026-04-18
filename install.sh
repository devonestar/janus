#!/usr/bin/env bash
# Janus — AI-native decision gate for PRD/spec markdown
# One-line install: curl -fsSL https://raw.githubusercontent.com/devonestar/janus/main/install.sh | bash
set -euo pipefail

PACKAGE="janus-gate"
MIN_NODE=18

echo ""
echo "  Janus — AI-native decision gate"
echo "  https://github.com/devonestar/janus"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required (v${MIN_NODE}+)."
  echo "Install it from https://nodejs.org or via your package manager."
  exit 1
fi

NODE_VERSION=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt "$MIN_NODE" ]; then
  echo "Error: Node.js v${MIN_NODE}+ required. Found v$(node -v)."
  exit 1
fi

echo "Node.js $(node -v) detected."

# Install globally
echo "Installing ${PACKAGE} globally..."
npm install -g "${PACKAGE}"

# Verify
if command -v janus &>/dev/null; then
  echo ""
  echo "Installed successfully! Version: $(janus --version 2>/dev/null || echo 'unknown')"
  echo ""
  echo "Usage:"
  echo "  janus eval your-spec.md"
  echo "  janus compare a.md b.md"
  echo "  janus gate pr-spec.md"
  echo ""
  echo "★ If Janus helps your workflow, consider starring the repo!"
  echo "  gh repo star devonestar/janus"
  echo ""
else
  echo "Warning: Installation completed but 'janus' not found in PATH."
  echo "Try: npx ${PACKAGE} eval your-spec.md"
fi
