#!/bin/bash
# Push script for Choice Properties
cd "$(dirname "$0")"

echo "📊 Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
  echo "📝 Staging changes..."
  git add -A
  MSG="${1:-feat(extension): release v18.0.0 with universal zip serving and Opendoor/Progress Residential support}"
  echo "✅ Committing changes: $MSG..."
  git commit -m "$MSG"
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
