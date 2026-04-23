import express from 'express';

const router = express.Router();
const FRED_KEY  = process.env.FRED_API_KEY || '';
const GROQ_KEY  = process.env.GROQ_API_KEY || '';
const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

// FRED series we track
const SERIES = {
  DGS2:    { label: '2Y Treasury',    unit: '%',  dec: 2 },
  DGS5:    { label: '5Y Treasury',    unit: '%',  dec: 2 },
  DGS10:   { label: '10Y Treasury',   unit: '%',  dec: 2 },
  DGS30:   { label: '30Y Treasury',   unit: '%',  dec: 2 },
  FEDFUNDS:{ label: 'Fed Funds Rate', unit: '%',  dec: 2 },
  CPIAUCSL:{ label: 'CPI YoY',        unit: '%',  dec: 1 },
  PCEPI:   { label: 'PCE Inflation',  unit: '%',  dec: 1 },
  UNRATE:  { label: 'Unemployment',   unit: '%',  dec: 1 },
  NAPM:    { label: 'ISM Mfg PMI',    unit: '',   dec: 1 },
  NMFSC:   { label: 'ISM Svc PMI',    unit: '',   dec: 1 },
  M2SL:    { label: 'M2 Money Supply',unit: '$T', dec: 1 },
  BAMLH0A0HYM2: { label: 'HY Spread', unit: 'bps', dec: 0 },
  T10Y2Y:  { label: 'Yield Curve (10Y-2Y)', unit: 'bps', dec: 2 },
};

async function fredFetch(seriesId, limit = 24) {
  if (!FRED_KEY) throw new Error('FRED_API_KEY not set');
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&limit=${limit}&sort_order=desc`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FRED ${r.status} for ${seriesId}`);
  const data = await r.json();
  return (data.observations || [])
    .filter(o => o.value !== '.')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
}

// GET /api/macro — fetch all FRED series
router.get('/', async (req, res) => {
  try {
    const results = await Promise.allSettled(
      Object.entries(SERIES).map(async ([id, meta]) => {
        try {
          const obs = await fredFetch(id, 24);
          const latest = obs[obs.length - 1];
          const prev   = obs[obs.length - 2];
          const change = (latest && prev) ? latest.value - prev.value : 0;
          return { id, label: meta.label, unit: meta.unit, dec: meta.dec,
                   value: latest?.value ?? null, change,
                   history: obs.slice(-12) };
        } catch {
          return { id, label: meta.label, unit: meta.unit, dec: meta.dec, value: null, change: 0, history: [] };
        }
      })
    );
    const data = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/macro/:seriesId/history — longer history for charts
router.get('/:seriesId/history', async (req, res) => {
  try {
    const obs = await fredFetch(req.params.seriesId.toUpperCase(), 60);
    res.json(obs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/macro/regime — Groq AI macro regime summary
router.post('/regime', async (req, res) => {
  try {
    const { indicators } = req.body; // array of { label, value, unit }
    if (!GROQ_KEY) return res.json({ regime: 'unknown', summary: 'GROQ_API_KEY not set' });

    const lines = (indicators || []).map(i => `${i.label}: ${i.value}${i.unit}`).join('\n');
    const prompt = `Given the following macro indicators, classify the current regime and provide a 3-sentence briefing for an investment professional.

${lines}

Respond with JSON only: { "regime": "one of: risk-on|risk-off|stagflation|goldilocks|recession|recovery|tightening|easing", "color": "one of: green|red|yellow|blue", "summary": "3 sentences max, direct, no filler" }`;

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 200, temperature: 0.3,
        messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
