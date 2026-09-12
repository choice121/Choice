#!/bin/bash
# Push script for Choice Properties
cd "$(dirname "$0")"

echo "📊 Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
  echo "📝 Staging changes..."
  git add -A
  echo "✅ Committing changes..."
  git commit -m "feat(extension): upgrade Zillow UI to v5.0 with live inspection card, integrated photo progress, and instant live loader"
fi

echo "📤 Pushing changes to GitHub..."
TOKEN="${GitHubtoken:-$GITHUB_TOKEN}"
if [ -n "$TOKEN" ]; then
  git push "https://${TOKEN}@github.com/choice121/Choice.git" main
else
  git push origin main
fi

if [ $? -eq 0 ]; then
  echo "✅ SUCCESS! Changes pushed to GitHub"
  echo ""
  echo "📊 Deployment status:"
  echo "   - GitHub: https://github.com/choice121/Choice"
  echo "   - Cloudflare auto-deploys in 1-2 minutes"
  echo "   - Extension picks up updates immediately on next page refresh!"
else
  echo "❌ FAILED! Error pushing to GitHub"
  echo "   If authentication failed, export GITHUB_TOKEN='your_personal_access_token' and re-run ./push.sh"
fi
