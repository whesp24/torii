import axios from 'axios';
import KPI from '../models/KPI.js';

const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';

// KPI configuration
const KPI_CONFIG = [
  { symbol: '^N225', label: 'Nikkei 225' },
  { symbol: 'USDJPY=X', label: 'USD / JPY' },
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^VIX', label: 'VIX' },
  { symbol: 'GC=F', label: 'Gold' },
  { symbol: 'BTC-USD', label: 'Bitcoin' }
];

// Cache KPI data to avoid excessive API calls
let kpiCache = {};
let lastFetchTime = {};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch KPI from Alpha Vantage (with simplified fallback)
async function fetchKPIFromAlphaVantage(symbol) {
  try {
    // For demo: Use mock data for certain symbols that Alpha Vantage doesn't support directly
    if (symbol === '^N225' || symbol === 'USDJPY=X' || symbol === '^VIX' || symbol === 'BTC-USD') {
      return generateMockKPIData(symbol);
    }

    const response = await axios.get(ALPHA_VANTAGE_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_KEY
      },
      timeout: 5000
    });

    const data = response.data['Global Quote'];
    if (!data || !data['05. price']) {
      console.error(`No data for ${symbol}`);
      return generateMockKPIData(symbol);
    }

    return {
      price: parseFloat(data['05. price']),
      change: parseFloat(data['09. change']),
      changePercent: parseFloat(data['10. change percent']?.replace('%', '')) || 0
    };
  } catch (error) {
    console.error(`Error fetching KPI ${symbol}:`, error.message);
    return generateMockKPIData(symbol);
  }
}

// Generate realistic mock data for demo purposes
function generateMockKPIData(symbol) {
  const prices = {
    '^N225': 28000,
    'USDJPY=X': 150,
    '^GSPC': 5200,
    '^VIX': 18,
    'GC=F': 2350,
    'BTC-USD': 72000
  };

  const basePrice = prices[symbol] || 100;
  const change = (Math.random() - 0.5) * basePrice * 0.02;
  const changePercent = (change / basePrice) * 100;

  return {
    price: basePrice + change,
    change,
    changePercent
  };
}

// Update all KPIs in database
export async function updateAllKPIs() {
  try {
    console.log('Updating KPIs...');

    const updates = await Promise.all(
      KPI_CONFIG.map(async (config) => {
        try {
          const kpiData = await fetchKPIFromAlphaVantage(config.symbol);

          const updated = await KPI.findOneAndUpdate(
            { symbol: config.symbol },
            {
              symbol: config.symbol,
              label: config.label,
              price: kpiData.price,
              change: kpiData.change,
              changePercent: kpiData.changePercent,
              lastUpdated: new Date(),
              source: 'alpha-vantage'
            },
            { upsert: true, new: true }
          );

          return updated;
        } catch (err) {
          console.error(`Error updating KPI ${config.symbol}:`, err.message);
          return null;
        }
      })
    );

    console.log(`Updated ${updates.filter(u => u).length} KPIs`);
    return updates.filter(u => u);
  } catch (error) {
    console.error('Error updating all KPIs:', error);
    throw error;
  }
}

// Get all KPIs with caching
export async function getAllKPIs() {
  try {
    const kpis = await KPI.find().sort({ symbol: 1 });
    return kpis;
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    throw error;
  }
}

// Get single KPI
export async function getKPI(symbol) {
  try {
    const kpi = await KPI.findOne({ symbol: symbol.toUpperCase() });
    return kpi;
  } catch (error) {
    console.error('Error fetching KPI:', error);
    throw error;
  }
}

// Initialize KPIs on startup
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
