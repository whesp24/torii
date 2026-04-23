import KPI from '../models/KPI.js';

// All symbols are valid Yahoo Finance tickers — no API key needed
const KPI_CONFIG = [
  { symbol: '^N225',   label: 'Nikkei 225' },
  { symbol: 'USDJPY=X', label: 'USD / JPY' },
  { symbol: '^GSPC',   label: 'S&P 500' },
  { symbol: '^VIX',    label: 'VIX' },
  { symbol: 'GC=F',    label: 'Gold' },
  { symbol: 'BTC-USD', label: 'Bitcoin' }
];

export async function updateAllKPIs() {
  try {
    const yahooFinance = (await import('yahoo-finance2')).default;

    const updates = await Promise.all(
      KPI_CONFIG.map(async (config) => {
        try {
          const quote = await yahooFinance.quote(config.symbol);

          if (!quote || !quote.regularMarketPrice) {
            console.error(`No data for KPI ${config.symbol}`);
            return null;
          }

          const updated = await KPI.findOneAndUpdate(
            { symbol: config.symbol },
            {
              symbol: config.symbol,
              label: config.label,
              price: quote.regularMarketPrice,
              change: quote.regularMarketChange ?? 0,
              changePercent: quote.regularMarketChangePercent ?? 0,
              lastUpdated: new Date(),
              source: 'yahoo-finance'
            },
            { upsert: true, new: true }
          );

          console.log(`✓ KPI ${config.label}: ${quote.regularMarketPrice}`);
          return updated;
        } catch (err) {
          console.error(`Error updating KPI ${config.symbol}:`, err.message);
          return null;
        }
      })
    );

    const count = updates.filter(u => u).length;
    console.log(`Updated ${count}/${KPI_CONFIG.length} KPIs`);
    return updates.filter(u => u);
  } catch (error) {
    console.error('Error updating all KPIs:', error);
    throw error;
  }
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
    const existingCount = await KPI.countDocuments();
    if (existingCount === 0) {
      console.log('Initializing KPIs...');
      await updateAllKPIs();
    }
  } catch (error) {
    console.error('Error initializing KPIs:', error);
  }
}
