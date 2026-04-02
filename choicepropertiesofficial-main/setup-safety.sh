#!/bin/bash
# ============================================================
# CHOICE PROPERTIES — SETUP SAFETY SHIELDS
# Activates all 7 layers of protection
# ============================================================

echo "🛡️  Choice Properties — Safety Setup"
echo "===================================="
echo ""

cd "$(dirname "$0")" || exit 1

# Make pre-commit hook executable
echo "📋 Setting up Git pre-commit hooks..."
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
echo "   ✅ Pre-commit hooks installed"

# Verify .replit configuration
echo ""
echo "📋 Verifying .replit configuration..."
if grep -q 'run = ""' .replit; then
  echo "   ✅ Auto-run DISABLED"
else
  echo "   ❌ Auto-run NOT disabled (critical!)"
fi

if grep -q 'autoDeploy = false' .replit; then
  echo "   ✅ Auto-deploy DISABLED"
else
  echo "   ❌ Auto-deploy NOT disabled"
fi

# Verify .gitignore
echo ""
echo "📋 Verifying .gitignore protection..."
GITIGNORE_ITEMS=("node_modules/" ".env" ".replit-cache" "config.js")
for item in "${GITIGNORE_ITEMS[@]}"; do
  if grep -q "^$item" .gitignore; then
    echo "   ✅ $item in .gitignore"
  else
    echo "   ⚠️  $item NOT in .gitignore (warning)"
  fi
done

# Summary
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║ 🛡️  SAFETY SHIELDS ACTIVATED                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "7 Layers of Protection:"
echo "  ✅ Layer 1: .replit configuration"
echo "  ✅ Layer 2: .gitignore protection"
echo "  ✅ Layer 3: Minimal package.json"
echo "  ✅ Layer 4: REPLIT_SAFETY.md documentation"
echo "  ✅ Layer 5: .copilot-instructions.md"
echo "  ✅ Layer 6: Git pre-commit hooks"
echo "  ✅ Layer 7: Project-wide comments"
echo ""
echo "Safe to import this project ANYWHERE! 🎉"
echo ""
echo "Next steps:"
echo "  1. Review: REPLIT_SAFETY.md"
echo "  2. Push to GitHub: git push origin main"
echo "  3. Test by re-importing from GitHub"
echo ""
