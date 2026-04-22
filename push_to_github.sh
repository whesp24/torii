#!/bin/bash
# ─── TORII: Push redesign to GitHub → triggers Railway auto-deploy ──────────────
# Run this from the root of your cloned Torii repo:
#   bash push_to_github.sh

set -e

echo "📁 Copying files into repo..."

# Copy index.html (overwrites existing)
cp "$(dirname "$0")/index.html" ./index.html

# Copy JS files
mkdir -p js
cp "$(dirname "$0")/js/torii-data.js"        ./js/torii-data.js
cp "$(dirname "$0")/js/torii-ui.jsx"         ./js/torii-ui.jsx
cp "$(dirname "$0")/js/torii-shell.jsx"      ./js/torii-shell.jsx
cp "$(dirname "$0")/js/torii-overview.jsx"   ./js/torii-overview.jsx
cp "$(dirname "$0")/js/torii-pages.jsx"      ./js/torii-pages.jsx
cp "$(dirname "$0")/js/torii-networking.jsx" ./js/torii-networking.jsx
cp "$(dirname "$0")/js/torii-projects.jsx"   ./js/torii-projects.jsx

echo "✅ Files copied."

echo "🔍 Git status:"
git status

echo ""
echo "📦 Staging all changes..."
git add index.html js/

echo "💬 Committing..."
git commit -m "redesign: full UI overhaul — new CSS tokens, shell, pages, networking, projects"

echo "🚀 Pushing to GitHub (triggers Railway deploy)..."
git push

echo ""
echo "✅ Done! Railway will auto-deploy momentarily."
echo "   Check your Railway dashboard for deploy status."
