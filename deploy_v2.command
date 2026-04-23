#!/bin/bash
cd "$(dirname "$0")"

echo "🔓 Clearing git lock files..."
rm -f .git/index.lock .git/HEAD.lock .git/refs/heads/master.lock 2>/dev/null

echo "📦 Staging all changes..."
git add index.html
git add js/torii-pages.jsx
git add js/torii-shell.jsx
git add server/models/Stock.js
git add server/package.json
git add server/server.js
git add server/services/stockService.js
git add server/models/PushSubscription.js
git add server/routes/analytics.js
git add server/routes/earnings.js
git add server/routes/push.js
git add server/services/emailService.js
git add sw.js

echo "✅ Committing..."
git commit -m "feat: add 10 new features — watchlist, alerts, earnings, ecocal, tools, analytics, push, email"

echo "🚀 Pushing to GitHub (triggers Render deploy)..."
git push origin master:main

echo "🎉 Done! Render will deploy in ~2 minutes."
echo "📬 To enable email digest: set EMAIL_FROM, EMAIL_PASS, EMAIL_TO in Render env vars"
echo "🔔 To enable push notifications: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY in Render env vars"
echo "   Generate with: cd server && node -e \"const wp=require('web-push'); console.log(wp.generateVAPIDKeys())\""
