#!/bin/bash
# ─── TORII: Deploy service fixes to GitHub → triggers Render auto-deploy ──────
cd "$(dirname "$0")"

echo ""
echo "🔧 Torii — Deploying data source fixes to GitHub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Remove stale git lock file if present
if [ -f .git/index.lock ]; then
  echo "🔓 Removing stale git lock file..."
  rm -f .git/index.lock
fi

echo ""
echo "📋 Current git status:"
git status --short

echo ""
echo "📦 Staging all service fixes..."
git add server/package.json \
        server/services/stockService.js \
        server/services/tweetService.js \
        server/services/newsService.js \
        server/services/alertService.js \
        server/services/kpiService.js \
        server/services/taskService.js \
        server/services/watchlistService.js \
        server/models/Alert.js \
        server/models/KPI.js \
        server/models/Task.js \
        server/models/Watchlist.js \
        server/routes/alerts.js \
        server/routes/kpis.js \
        server/routes/tasks.js \
        server/routes/watchlist.js

echo "✅ Files staged."

echo ""
echo "💬 Committing..."
git commit -m "fix: replace broken data sources with working free alternatives

- Stocks: swap Alpha Vantage (25 req/day limit) for yahoo-finance2 (free, no key)
- Social: replace dead nitter.net (shut down Feb 2024) with StockTwits public API
- News: replace NewsAPI (blocks server-side prod requests) with financial RSS feeds
  (WSJ, CNBC, MarketWatch, Nikkei Asia, TechCrunch, The Verge)
- Add yahoo-finance2 to package.json dependencies
- Include previously missing model/route/service files"

echo ""
echo "🚀 Pushing to GitHub (triggers Render auto-deploy)..."
git push origin HEAD:main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Done! Render will auto-deploy in ~1-2 minutes."
echo "   Check your Render dashboard for deploy status."
echo "   Press any key to close this window."
read -n 1
