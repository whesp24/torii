import KPI from '../models/KPI.js';

// Stooq free market data — no API key, works from datacenter IPs
const KPI_CONFIG = [
  // Japan / Asia
  { symbol: '^N225',    stooq: '^nkx',    label: 'Nikkei 225',  category: 'asia' },
  { symbol: 'USDJPY=X', stooq: 'usdjpy',  label: 'USD/JPY',     category: 'fx'   },
  { symbol: '^TOPX',    stooq: '^tpx',    label: 'TOPIX',       category: 'asia' },
  { symbol: '^HSI',     stooq: '^hsi',    label: 'Hang Seng',   category: 'asia' },
  // US Markets
  { symbol: '^GSPC',    stooq: '^spx',    label: 'S&P 500',     category: 'us'   },
  { symbol: '^DJI',     stooq: '^dji',    label: 'DJIA',        category: 'us'   },
  { symbol: '^IXIC',    stooq: '^ndq',    label: 'Nasdaq',      category: 'us'   },
  { symbol: '^VIX',     stooq: '^vix',    label: 'VIX',         category: 'us'   },
  // Macro / Commodities
  { symbol: 'GC=F',     stooq: 'gc.f',    label: 'Gold',        category: 'macro' },
  { symbol: 'CL=F',     stooq: 'cl.f',    label: 'Crude Oil',   category: 'macro' },
  { symbol: '^TNX',     stooq: '10usy.b', label: '10Y Yield',   category: 'macro' },
  { symbol: 'DX=F',     stooq: 'dxy',     label: 'DXY',         category: 'macro' },
  // FX
  { symbol: 'EURUSD=X', stooq: 'eurusd',  label: 'EUR/USD',     category: 'fx'   },
  // ETFs / Crypto
  { symbol: 'EWJ',      stooq: 'ewj.us',  label: 'EWJ ETF',     category: 'asia' },
  { symbol: 'BTC-USD',  stooq: 'btc.v',   label: 'Bitcoin',     category: 'macro' },
];

async function fetchStooqQuote(stooqSymbol) {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/csv,text/plain,*/*',
      'Referer': 'https://stooq.com/',
    }
  });
  if (!r.ok) throw new Error(`Stooq HTTP ${r.status} for ${stooqSymbol}`);
  const text = await r.text();
  if (text.includes('No data') || text.trim() === '') throw new Error(`Stooq: no data for ${stooqSymbol}`);

  const lines = text.trim().split('\n').filter(l => l && !l.toLowerCase().startsWith('date'));
  if (lines.length < 1) throw new Error(`Stooq: empty response for ${stooqSymbol}`);

  const parseRow = (line) => {
    const parts = line.split(',');
    return {
      date: parts[0]?.trim(),
      open:  parseFloat(parts[1]) || 0,
      high:  parseFloat(parts[2]) || 0,
      low:   parseFloat(parts[3]) || 0,
      close: parseFloat(parts[4]) || 0,
      vol:   parseFloat(parts[5]) || 0,
    };
  };

  const current = parseRow(lines[lines.length - 1]);
  const prev    = lines.length >= 2 ? parseRow(lines[lines.length - 2]) : null;

  if (!current.close || isNaN(current.close)) throw new Error(`Stooq: bad close for ${stooqSymbol}`);

  const prevClose = prev?.close || current.open || current.close;
  const change = current.close - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return { price: current.close, change, changePercent };
}

const KPI_CACHE_MS = 20 * 60 * 1000; // 20 min

export async function updateAllKPIs({ force = false } = {}) {
  let updated = 0, skipped = 0, failed = 0;
  for (const cfg of KPI_CONFIG) {
    try {
      if (!force) {
        const existing = await KPI.findOne({ symbol: cfg.symbol }).lean();
        if (existing?.lastUpdated) {
          const age = Date.now() - new Date(existing.lastUpdated).getTime();
          if (age < KPI_CACHE_MS) { skipped++; continue; }
        }
      }
      const q = await fetchStooqQuote(cfg.stooq);
      await KPI.findOneAndUpdate(
        { symbol: cfg.symbol },
        { symbol: cfg.symbol, label: cfg.label, category: cfg.category,
          price: q.price, change: q.change, changePercent: q.changePercent,
          lastUpdated: new Date(), source: 'stooq' },
        { upsert: true, new: true }
      );
      console.log(`✓ KPI ${cfg.label}: ${q.price.toFixed(2)} (${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%)`);
      updated++;
      await new Promise(r => setTimeout(r, 800)); // space requests
    } catch (err) {
      console.error(`✗ KPI ${cfg.label} (${cfg.stooq}): ${err.message}`);
      failed++;
    }
  }
  console.log(`KPI update: ${updated} updated, ${skipped} cached, ${failed} failed`);
}

export async function initializeKPIs() {
  console.log('Initializing KPIs (Stooq, cache-aware)...');
  await updateAllKPIs({ force: false });
}

export async function getAllKPIs() {
  return KPI.find().sort({ symbol: 1 });
}

export async function getKPI(symbol) {
  return KPI.findOne({ symbol });
}
