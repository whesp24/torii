import KPI from '../models/KPI.js';
import { fetchYahooQuote } from './stockService.js';

// KPI symbols — mix of indices, forex, ETF, commodities
const KPI_CONFIG = [
  { symbol: '^N225',    label: 'Nikkei 225' },
  { symbol: 'USDJPY=X', label: 'USD / JPY'  },
  { symbol: '^TOPX',    label: 'TOPIX'      },
  { symbol: '^GSPC',    label: 'S&P 500'    },
  { symbol: '^DJI',     label: 'DJIA'       },
  { symbol: '^VIX',     label: 'VIX'        },
  { symbol: 'GC=F',     label: 'Gold'       },
  { symbol: 'EWJ',      label: 'EWJ ETF'    },
  { symbol: '^TNX',     label: '10Y'        },
];

const KPI_CACHE_MS = 25 * 60 * 1000; // 25 minutes — don't re-hit Yahoo if fresh

export async function updateAllKPIs({ force = false } = {}) {
  let count = 0;
  for (const cfg of KPI_CONFIG) {
    try {
      // Skip if cached value is still fresh (avoids Yahoo 429 on cold starts)
      if (!force) {
        const existing = await KPI.findOne({ symbol: cfg.symbol }).lean();
        if (existing?.lastUpdated) {
          const age = Date.now() - new Date(existing.lastUpdated).getTime();
          if (age < KPI_CACHE_MS) {
            console.log(`⏭  KPI ${cfg.label} cached (${Math.round(age/60000)}m old) — skipping`);
            count++;
            continue;
          }
        }
      }
      // Indices, forex, commodities — Yahoo with cookie session
      const q = await fetchYahooQuote(cfg.symbol);
      await KPI.findOneAndUpdate(
        { symbol: cfg.symbol },
        {
          symbol:        cfg.symbol,
          label:         cfg.label,
          price:         q.price,
          change:        q.change,
          changePercent: q.changePercent,
          lastUpdated:   new Date(),
          source:        'yahoo-chart'
        },
        { upsert: true, new: true }
      );
      console.log(`✓ KPI ${cfg.label}: ${q.price}`);
      count++;
      await new Promise(r => setTimeout(r, 1200)); // 1.2s between requests
    } catch (err) {
      console.error(`Error updating KPI ${cfg.symbol}:`, err.message);
    }
  }
  console.log(`KPI update complete — ${count}/${KPI_CONFIG.length} updated`);
}

export async function getAllKPIs() {
  try {
    return await KPI.find().sort({ symbol: 1 });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    throw error;
  }
}

export async function getKPI(symbol) {
  try {
    return await KPI.findOne({ symbol });
  } catch (error) {
    console.error('Error fetching KPI:', error);
    throw error;
  }
}

export async function initializeKPIs() {
  try {
    // Use cache-aware update — only fetches symbols that are stale
    console.log('Initializing KPIs (cache-aware)...');
    await updateAllKPIs({ force: false });
  } catch (error) {
    console.error('Error initializing KPIs:', error);
  }
}
