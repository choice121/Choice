#!/bin/bash
# Deployment verification script for hybrid React + Legacy migration
# Checks that everything is ready for Cloudflare Pages deployment

set -e

DIST_DIR="/workspaces/Choice/dist"
ERRORS=0
WARNINGS=0

echo "🔍 Choice Properties — Production Deployment Checklist"
echo "========================================================"
echo ""

# Check React build
echo "📦 React Build Check"
if [ -f "$DIST_DIR/index.html" ]; then
  SIZE=$(wc -c < "$DIST_DIR/index.html")
  echo "   ✅ index.html present ($SIZE bytes)"
else
  echo "   ❌ index.html missing!"
  ((ERRORS++))
fi

if [ -d "$DIST_DIR/assets/react" ]; then
  ASSET_COUNT=$(find "$DIST_DIR/assets/react" -type f | wc -l)
  echo "   ✅ React assets present ($ASSET_COUNT files)"
else
  echo "   ❌ React assets directory missing!"
  ((ERRORS++))
fi

echo ""

# Check protected flows
echo "🔒 Protected Flows Check (Legacy)"
PROTECTED_DIRS=("admin" "apply" "landlord" "tenant" "auth")
for dir in "${PROTECTED_DIRS[@]}"; do
  if [ -d "$DIST_DIR/$dir" ]; then
    echo "   ✅ /$dir/ directory present"
  else
    echo "   ⚠️  /$dir/ directory missing"
    ((WARNINGS++))
  fi
done

echo ""

# Check critical files
echo "🔐 Critical Configuration Files"
CRITICAL_FILES=("config.js" "_redirects" "_headers" "manifest.json" "404.html")
for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$DIST_DIR/$file" ]; then
    echo "   ✅ $file present"
  else
    echo "   ❌ $file missing!"
    ((ERRORS++))
  fi
done

echo ""

# Check _redirects configuration
echo "🛣️  Cloudflare Routing Configuration"
if grep -q "/admin/\*.*200" "$DIST_DIR/_redirects"; then
  echo "   ✅ Admin routing configured"
else
  echo "   ⚠️  Admin routing may not be configured"
  ((WARNINGS++))
fi

if grep -q "/apply/\*.*200" "$DIST_DIR/_redirects"; then
  echo "   ✅ Application routing configured"
else
  echo "   ⚠️  Application routing may not be configured"
  ((WARNINGS++))
fi

if grep -q "/\*.*index.html.*200" "$DIST_DIR/_redirects"; then
  echo "   ✅ React SPA catch-all configured"
else
  echo "   ⚠️  React SPA catch-all may not be configured"
  ((WARNINGS++))
fi

echo ""

# Check build size
echo "📊 Build Size Report"
TOTAL_SIZE=$(du -sh "$DIST_DIR" | awk '{print $1}')
REACT_SIZE=$(du -sh "$DIST_DIR/assets/react" 2>/dev/null | awk '{print $1}' || echo "N/A")
echo "   Total dist/ size: $TOTAL_SIZE"
echo "   React assets size: $REACT_SIZE"

echo ""

# Check for legacy HTML files (should exist as fallbacks)
echo "📄 Legacy HTML Fallbacks"
LEGACY_FILES=("property.html" "listings.html" "about.html" "privacy.html")
for file in "${LEGACY_FILES[@]}"; do
  if [ -f "$DIST_DIR/$file" ]; then
    SIZE=$(wc -c < "$DIST_DIR/$file" | numfmt --to=iec 2>/dev/null || echo "$(wc -c < "$DIST_DIR/$file") bytes")
    echo "   ✅ $file available as fallback"
  else
    echo "   ⚠️  $file missing (non-critical)"
    ((WARNINGS++))
  fi
done

echo ""
echo "========================================================"

if [ $ERRORS -eq 0 ]; then
  echo "✅ All critical checks passed!"
  if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  $WARNINGS warnings detected (non-critical)"
  fi
  echo ""
  echo "🚀 Ready for deployment to Cloudflare Pages"
  exit 0
else
  echo "❌ $ERRORS critical errors detected"
  echo ""
  echo "⛔ Not ready for deployment. Fix errors above."
  exit 1
fi
