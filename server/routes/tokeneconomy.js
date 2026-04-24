import express from 'express';
import * as yahooClient from '../lib/yahooClient.js';
import Stock from '../models/Stock.js';

const router = express.Router();

const AI_STOCKS = ['NVDA', 'AMD', 'MSFT', 'GOOGL', 'META', 'TSLA', 'ARM', 'AVGO'];

// Helper function to fetch crypto prices from Binance public API
// (CoinGecko free tier is heavily rate-limited from cloud IPs; Binance is unlimited)
async function fetchCryptoPrices() {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'LINKUSDT'];
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`Binance API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    const symbolMap = {
      BTCUSDT:  { symbol: 'BTC',  name: 'Bitcoin' },
      ETHUSDT:  { symbol: 'ETH',  name: 'Ethereum' },
      SOLUSDT:  { symbol: 'SOL',  name: 'Solana' },
      LINKUSDT: { symbol: 'LINK', name: 'Chainlink' },
    };

    return data.map(item => {
      const info = symbolMap[item.symbol];
      if (!info) return null;
      return {
        symbol:   info.symbol,
        name:     info.name,
        price:    parseFloat(parseFloat(item.lastPrice).toFixed(2)),
        change24h: parseFloat(parseFloat(item.priceChangePercent).toFixed(2)),
      };
    }).filter(Boolean);
  } catch (error) {
    console.error('Error fetching crypto prices from Binance:', error.message);
    return [];
  }
}

// Helper function to fetch AI stock quotes
async function fetchAIStockQuotes() {
  const aiStocks = [];

  // Map of company names for display
  const nameMap = {
    NVDA: 'NVIDIA',
    AMD: 'Advanced Micro Devices',
    MSFT: 'Microsoft',
    GOOGL: 'Alphabet',
    META: 'Meta Platforms',
    TSLA: 'Tesla',
    ARM: 'ARM Holdings',
    AVGO: 'Broadcom',
  };

  for (const symbol of AI_STOCKS) {
    try {
      const quote = await yahooClient.quoteSummary(symbol, {
        modules: ['price'],
      });

      // yahooClient.quoteSummary() returns the unwrapped result[0] object directly
      // quote.price is the price module — NOT quote.quoteSummary.result[0].price
      if (quote && quote.price) {
        const priceData = quote.price;

        if (priceData) {
          const currentPrice = priceData.regularMarketPrice?.raw ?? priceData.regularMarketPrice;
          const previousClose = priceData.regularMarketPreviousClose?.raw ?? priceData.regularMarketPreviousClose;
          const change = currentPrice - previousClose;
          const changePercent = ((change / previousClose) * 100).toFixed(2);

          aiStocks.push({
            symbol,
            name: nameMap[symbol] || symbol,
            price: parseFloat(currentPrice.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent),
          });
        }
      }
    } catch (error) {
      console.warn(`Error fetching quote for ${symbol}:`, error.message);
      // Continue with next symbol
    }
  }

  return aiStocks;
}

// Simple cache — avoid hammering Yahoo on every page load
let _cache = null;
let _cacheTs = 0;

// GET /token-economy - Fetch AI stocks and crypto prices snapshot
router.get('/', async (req, res) => {
  try {
    // Serve cache if < 5 minutes old
    if (_cache && Date.now() - _cacheTs < 5 * 60 * 1000) {
      return res.json(_cache);
    }

    let [aiStocks, crypto] = await Promise.all([
      fetchAIStockQuotes(),
      fetchCryptoPrices(),
    ]);

    // Fallback: if live Yahoo fetch returned few/no results, pull from DB cache
    // (the cron job updates Stock docs every 15 min, so data is reasonably fresh)
    if (aiStocks.length < 4) {
      try {
        const dbStocks = await Stock.find({ symbol: { $in: AI_STOCKS } }).lean();
        const nameMap = {
          NVDA: 'NVIDIA', AMD: 'Advanced Micro Devices', MSFT: 'Microsoft',
          GOOGL: 'Alphabet', META: 'Meta Platforms', TSLA: 'Tesla',
          ARM: 'ARM Holdings', AVGO: 'Broadcom',
        };
        const liveSymbols = new Set(aiStocks.map(s => s.symbol));
        for (const s of dbStocks) {
          if (!liveSymbols.has(s.symbol)) {
            aiStocks.push({
              symbol: s.symbol,
              name: nameMap[s.symbol] || s.name || s.symbol,
              price: s.price,
              change: s.change,
              changePercent: s.changePercent,
            });
          }
        }
      } catch (dbErr) {
        console.warn('Token economy DB fallback failed:', dbErr.message);
      }
    }

    // Flat response — frontend reads data.aiStocks / data.crypto directly
    const response = {
      aiStocks,
      crypto,
      updatedAt: new Date().toISOString(),
      warnings: [
        aiStocks.length < AI_STOCKS.length ? `Fetched ${aiStocks.length}/${AI_STOCKS.length} AI stocks` : null,
        crypto.length === 0 ? 'Binance unavailable — crypto data missing' : null,
      ].filter(Boolean),
    };

    _cache = response;
    _cacheTs = Date.now();
    res.json(response);
  } catch (error) {
    console.error('Error fetching token economy data:', error.message);
    res.json({ aiStocks: [], crypto: [], updatedAt: new Date().toISOString(), error: error.message });
  }
});

export default router;
