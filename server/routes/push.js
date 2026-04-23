import express from 'express';
import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

const router = express.Router();

// Set VAPID details if configured
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL   = process.env.VAPID_EMAIL || 'mailto:admin@torii.app';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

// GET /api/push/vapid-public — frontend needs this to subscribe
router.get('/vapid-public', (req, res) => {
  if (!VAPID_PUBLIC) return res.json({ key: null, enabled: false });
  res.json({ key: VAPID_PUBLIC, enabled: true });
});

// POST /api/push/subscribe — save a push subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { endpoint, keys },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/push/subscribe — remove a subscription
router.delete('/subscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({ endpoint });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Utility: send a push notification to all subscribers
export async function sendPushToAll(title, body, url = '/') {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const subs = await PushSubscription.find({});
  const payload = JSON.stringify({ title, body, url });
  const results = await Promise.allSettled(
    subs.map(s =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload)
        .catch(err => {
          // If subscription is gone, remove it
          if (err.statusCode === 410) PushSubscription.deleteOne({ endpoint: s.endpoint }).catch(() => {});
          throw err;
        })
    )
  );
  const sent = results.filter(r => r.status === 'fulfilled').length;
  console.log(`Push sent to ${sent}/${subs.length} subscribers`);
  return sent;
}

export default router;
