import express from 'express';

const router = express.Router();
const FRED_KEY  = process.env.FRED_API_KEY || '';
const GROQ_KEY  = process.env.GROQ_API_KEY || '';
const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

// FRED series we track.
// yoy:true  → display value as year-over-year % change (for index series like CPI/PCE)
// x100:true → multiply raw value × 100 before display (convert % to bps etc.)
// raw:true  → display the raw level value with no extra math (default)
const SERIES = {
  FEDFUNDS:  { label: 'Fed Funds Rate',        unit: '%',  dec: 2 },
  CPIAUCSL:  { label: 'CPI YoY',               unit: '%',  dec: 1, yoy: true },
  PCEPI:     { label: 'PCE Inflation',          unit: '%',  dec: 1, yoy: true },
  UNRATE:    { label: 'Unemployment',           unit: '%',  dec: 1 },
  UMCSENT:   { label: 'Consumer Sentiment',     unit: '',   dec: 1 },
  VIXCLS:    { label: 'VIX',                    unit: '',   dec: 1 },
  M2SL:      { label: 'M2 Money Supply',        unit: '$T', dec: 1 },
  BAMLH0A0HYM2: { label: 'HY Spread',          unit: '%',  dec: 2 },
  T10Y2Y:    { label: 'Yield Curve (10Y-2Y)',   unit: '%',  dec: 2 },
  DGS10:     { label: '10Y Treasury',           unit: '%',  dec: 2 },
  DGS2:      { label: '2Y Treasury',            unit: '%',  dec: 2 },
  DGS5:      { label: '5Y Treasury',            unit: '%',  dec: 2 },
  DTWEXBGS:  { label: 'USD Index (Broad)',       unit: '',   dec: 1 },
};

// Fetch observations from FRED.  Returns array [{date, value}] oldest-first.
async function fredFetch(seriesId, limit = 26) {
  if (!FRED_KEY) throw new Error('NO_KEY');
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&limit=${limit}&sort_order=desc`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FRED ${r.status} for ${seriesId}`);
  const data = await r.json();
  if (data.error_code) throw new Error(`FRED error: ${data.error_message || data.error_code}`);
  return (data.observations || [])
    .filter(o => o.value !== '.')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();               // oldest → newest
}

// Compute the display value + MoM change for one series
function summarise(obs, meta) {
  if (!obs.length) return { value: null, change: 0 };

  const latest = obs[obs.length - 1].value;
  const prev   = obs.length >= 2 ? obs[obs.length - 2].value : latest;

  if (meta.yoy) {
    // Year-over-year percentage change (index series: CPI, PCE)
    // We need at least 13 observations (current + 12 months ago)
    const yearAgo = obs.length >= 13 ? obs[obs.length - 13].value : null;
    const yoyVal  = yearAgo ? ((latest - yearAgo) / yearAgo) * 100 : null;
    const momChange = yearAgo && obs.length >= 14
      ? yoyVal - ((obs[obs.length - 2].value - obs[obs.length - 14]?.value) / (obs[obs.length - 14]?.value || 1)) * 100
      : 0;
    return { value: yoyVal, change: parseFloat(momChange.toFixed(1)) };
  }

  if (meta.momDiff) {
    // Show MoM absolute change (e.g. payrolls: +256k jobs added)
    return { value: latest - prev, change: latest - prev };
  }

  // Default: show raw level, MoM point change
  return { value: latest, change: parseFloat((latest - prev).toFixed(meta.dec + 1)) };
}

// GET /api/macro — fetch all FRED series
router.get('/', async (req, res) => {
  try {
    const results = await Promise.allSettled(
      Object.entries(SERIES).map(async ([id, meta]) => {
        try {
          const limit = meta.yoy ? 26 : 24;   // need extra 12 for YoY calc
          const obs   = await fredFetch(id, limit);
          const { value, change } = summarise(obs, meta);
          return {
            id, label: meta.label, unit: meta.unit, dec: meta.dec,
            value, change,
            history: obs.slice(-12).map(o => ({
              date:  o.date,
              value: meta.yoy
                ? null   // history endpoint supplies proper YoY history
                : o.value,
            })),
          };
        } catch (e) {
          const msg = e.message === 'NO_KEY' ? 'No FRED key' : (e.message || 'Error');
          return { id, label: meta.label, unit: meta.unit, dec: meta.dec, value: null, change: 0, history: [], error: msg };
        }
      })
    );
    const data = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/macro/:seriesId/history — longer history for sparkline charts
router.get('/:seriesId/history', async (req, res) => {
  try {
    const id   = req.params.seriesId.toUpperCase();
    const meta = SERIES[id] || {};
    const obs  = await fredFetch(id, 72);   // 6 years

    if (meta.yoy) {
      // Convert index series to rolling YoY % so chart is meaningful
      const yoyObs = obs.slice(12).map((o, i) => ({
        date:  o.date,
        value: parseFloat(((o.value - obs[i].value) / obs[i].value * 100).toFixed(2)),
      }));
      return res.json(yoyObs);
    }

    res.json(obs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/macro/regime — Groq AI macro regime classifier
router.post('/regime', async (req, res) => {
  try {
    const { indicators } = req.body;
    if (!GROQ_KEY) return res.json({ regime: 'unknown', summary: 'GROQ_API_KEY not set' });

    const lines = (indicators || [])
      .filter(i => i.value !== null)
      .map(i => `${i.label}: ${i.value !== null ? Number(i.value).toFixed(i.dec ?? 1) : 'n/a'}${i.unit}`)
      .join('\n');

    const prompt = `Given the following macro indicators, classify the current regime and provide a 3-sentence briefing for a professional investor.

${lines}

Respond with JSON only: { "regime": "one of: risk-on|risk-off|stagflation|goldilocks|recession|recovery|tightening|easing", "color": "one of: green|red|yellow|blue", "summary": "3 sentences max, direct and specific, no filler phrases" }`;

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', max_tokens: 220, temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const gd = await r.json();
    const content = gd.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
