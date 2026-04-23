import KPI from '../models/KPI.js';
import { fetchYahooQuote } from './stockService.js';

// KPI symbols — mix of indices, forex, ETF, commodities
const KPI_CONFIG = [
  { symbol: '^N225',    label: 'Nikkei 225' },
  { symbol: 'USDJPY=X', label: 'USD / JPY'  },
  { symbol: '^GSPC',    label: 'S&P 500'    },
  { symbol: '^VIX',     label: 'VIX'        },
  { symbol: 'GC=F',     label: 'Gold'       },
  { symbol: 'EWJ',      label: 'EWJ ETF'    },
];

export async function updateAllKPIs() {
  let count = 0;
  for (const cfg of KPI_CONFIG) {
    try {
      // Indices, forex, commodities — Yahoo with cookie session works better than yahoo-finance2
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
      await new Promise(r => setTimeout(r, 500)); // space requests out
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
    const count = await KPI.countDocuments();
    if (count === 0) {
      console.log('Initializing KPIs...');
      await updateAllKPIs();
    } else {
      // Always refresh on startup
      console.log('Refreshing KPIs on startup...');
      await updateAllKPIs();
    }
  } catch (error) {
    console.error('Error initializing KPIs:', error);
  }
}
