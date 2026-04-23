import express from 'express';
import Watchlist from '../models/Watchlist.js';
import News from '../models/News.js';
import {
  getAllWatchlist,
  getWatchlistByCategory,
  getWatchlistItem,
  addToWatchlist,
  updateWatchlistItem,
  removeFromWatchlist,
  updateWatchlistPrice,
  getWatchlistWithAlerts
} from '../services/watchlistService.js';

const GROQ_KEY = process.env.GROQ_API_KEY || '';
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';

const router = express.Router();

// Get all watchlist items
router.get('/', async (req, res) => {
  try {
    const items = await getAllWatchlist();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get watchlist by category
router.get('/category/:category', async (req, res) => {
  try {
    const items = await getWatchlistByCategory(req.params.category);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get items with active alerts
router.get('/alerts/active', async (req, res) => {
  try {
    const items = await getWatchlistWithAlerts();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single watchlist item
router.get('/:symbol', async (req, res) => {
  try {
    const item = await getWatchlistItem(req.params.symbol);

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add to watchlist
router.post('/', async (req, res) => {
  try {
    const { symbol, name, category, notes, alertPrice, alertType } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const item = await addToWatchlist({
      symbol,
      name: name || '',
      category: category || 'stock',
      notes: notes || '',
      alertPrice: alertPrice || null,
      alertType: alertType || 'none'
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update watchlist item
router.put('/:symbol', async (req, res) => {
  try {
    const item = await updateWatchlistItem(req.params.symbol, req.body);

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update price data
router.patch('/:symbol/price', async (req, res) => {
  try {
    const { price, change, changePercent } = req.body;

    const item = await updateWatchlistPrice(req.params.symbol, {
      price,
      change,
      changePercent
    });

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove from watchlist
router.delete('/:symbol', async (req, res) => {
  try {
    const item = await removeFromWatchlist(req.params.symbol);
    if (!item) return res.status(404).json({ error: 'Watchlist item not found' });
    res.json({ message: 'Removed from watchlist', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /:symbol/thesis-check — Groq checks if thesis still holds given recent news
router.post('/:symbol/thesis-check', async (req, res) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    const item = await Watchlist.findOne({ symbol: sym });
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (!item.thesis?.trim()) return res.status(400).json({ error: 'No thesis written for this ticker' });
    if (!GROQ_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

    // Gather news: Finnhub first, then DB fallback
    let headlines = [];
    if (FINNHUB_KEY) {
      const to   = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      try {
        const r = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
        const articles = await r.json();
        headlines = (Array.isArray(articles) ? articles : []).slice(0, 10).map(a => a.headline).filter(Boolean);
      } catch (_) {}
    }
    if (headlines.length === 0) {
      const dbNews = await News.find({ publishedAt: { $gte: new Date(Date.now() - 14*86400000) } })
        .sort({ publishedAt: -1 }).limit(10);
      headlines = dbNews.map(n => n.title);
    }

    const prompt = `You are analyzing whether an investment thesis still holds based on recent news.

TICKER: ${sym}
THESIS: ${item.thesis}

RECENT HEADLINES (last 2 weeks):
${headlines.length ? headlines.map(h => `• ${h}`).join('\n') : '(No recent coverage found)'}

Assess whether the thesis is still valid. Respond with JSON only:
{ "status": "valid|weakening|invalidated", "summary": "2-3 sentences max, cite specific news if relevant", "confidence": 0.0-1.0 }`;

    const gr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 250, temperature: 0.2,
        messages: [{ role: 'user', content: prompt }] }),
    });
    const gd = await gr.json();
    const content = gd.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());

    // Save back to watchlist item
    await Watchlist.findOneAndUpdate({ symbol: sym }, {
      thesisStatus: parsed.status || 'unchecked',
      thesisSummary: parsed.summary || '',
      lastThesisCheck: new Date(),
    });

    res.json({ symbol: sym, ...parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:symbol/intelligence — update thesis, catalysts, conviction
router.put('/:symbol/intelligence', async (req, res) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    const { thesis, catalysts, conviction, sector } = req.body;
    const item = await Watchlist.findOneAndUpdate(
      { symbol: sym },
      { ...(thesis !== undefined && { thesis }),
        ...(catalysts !== undefined && { catalysts }),
        ...(conviction !== undefined && { conviction }),
        ...(sector !== undefined && { sector }) },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
