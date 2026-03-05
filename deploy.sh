#!/bin/bash
# One-command deploy: commit all changes, push to GitHub (Vercel auto-deploys from there).
# Run from project root: ./deploy.sh "Your commit message"
# Or: ./deploy.sh   (uses default message)

set -e
cd "$(dirname "$0")"

MSG="${1:-Deploy: updates from Cursor}"
git add -A
if git diff --staged --quiet; then
  echo "Nothing to commit. Working tree clean."
  exit 0
fi
git commit -m "$MSG"
git push origin main
echo "Pushed to GitHub. Vercel will deploy from main."
