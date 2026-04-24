import express from 'express';
import Position from '../models/Position.js';
import Trade from '../models/Trade.js';
import SportsBet from '../models/SportsBet.js';
import { fetchLiveQuote } from '../services/stockService.js';

const router = express.Router();

// GET / — unified capital allocation snapshot
// Returns total capital, breakdown by market, P&L, allocation percentages
router.get('/', async (req, res) => {
  try {
    const [positions, openTrades, closedTrades, pendingBets, settledBets] = await Promise.all([
      Position.find().lean(),
      Trade.find({ status: 'open' }).lean(),
      Trade.find({ status: 'closed' }).lean(),
      SportsBet.find({ status: 'pending' }).lean(),
      SportsBet.find({ status: { $in: ['won', 'lost', 'push'] } }).lean(),
    ]);

    // ── Equities: live portfolio value ─────────────────────────────────
    let equityValue = 0;
    let equityDayPnl = 0;
    let equityUnrealizedPnl = 0;
    const equityPositions = [];

    // Fetch live prices in parallel (cap at 10 to avoid Yahoo throttle)
    if (positions.length > 0) {
      const quotes = await Promise.allSettled(
        positions.slice(0, 15).map(p =>
          fetchLiveQuote(p.ticker).then(q => ({ ticker: p.ticker, ...q })).catch(() => ({ ticker: p.ticker }))
        )
      );

      for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        const q = i < quotes.length && quotes[i].status === 'fulfilled' ? quotes[i].value : {};
        const price = q.price || p.costBasis || 0;
        const value = p.shares * price;
        const dayChange = (q.change || 0) * p.shares;
        const costTotal = p.shares * (p.costBasis || price);
        const unrealized = value - costTotal;

        equityValue += value;
        equityDayPnl += dayChange;
        equityUnrealizedPnl += unrealized;

        equityPositions.push({
          ticker: p.ticker,
          shares: p.shares,
          costBasis: p.costBasis,
          currentPrice: price,
          value,
          dayChange,
          unrealizedPnl: unrealized,
          unrealizedPct: costTotal > 0 ? ((unrealized / costTotal) * 100) : 0,
        });
      }
    }

    // Realized equity P&L from closed trades
    const equityRealizedPnl = closedTrades.reduce((sum, t) => {
      if (t.exitPrice && t.price) {
        const mult = (t.action === 'buy' || t.action === 'cover') ? 1 : -1;
        return sum + mult * (t.exitPrice - t.price) * t.quantity;
      }
      return sum;
    }, 0);

    // ── Sports Betting: bankroll tracking ──────────────────────────────
    const sportsAtRisk = pendingBets.reduce((s, b) => s + (b.stake || 0), 0);
    const sportsTotalStaked = settledBets.reduce((s, b) => s + (b.stake || 0), 0);
    const sportsTotalResult = settledBets.reduce((s, b) => s + (b.result || 0), 0);
    const sportsWins = settledBets.filter(b => b.status === 'won').length;
    const sportsLosses = settledBets.filter(b => b.status === 'lost').length;
    const sportsWinRate = (sportsWins + sportsLosses) > 0 ? sportsWins / (sportsWins + sportsLosses) : 0;
    const sportsROI = sportsTotalStaked > 0 ? (sportsTotalResult / sportsTotalStaked) * 100 : 0;

    // ── Crypto: placeholder until wallet integration ───────────────────
    // For now, users track crypto positions in the equities Position model
    // (tickers like BTC, ETH will be treated as equities)
    // Future: direct wallet/exchange API integration

    // ── Total capital allocation ───────────────────────────────────────
    const totalCapital = equityValue + sportsAtRisk;
    const totalPnl = equityDayPnl; // today's mark-to-market
    const totalRealizedPnl = equityRealizedPnl + sportsTotalResult;

    // P&L time series from settled bets + closed trades
    const pnlHistory = [];
    const allEvents = [
      ...closedTrades.filter(t => t.exitDate).map(t => ({
        date: t.exitDate,
        pnl: t.exitPrice && t.price ? ((t.action === 'buy' || t.action === 'cover') ? 1 : -1) * (t.exitPrice - t.price) * t.quantity : 0,
        market: 'equities',
        label: t.ticker,
      })),
      ...settledBets.filter(b => b.settledAt).map(b => ({
        date: b.settledAt,
        pnl: b.result || 0,
        market: 'sports',
        label: `${b.sport}: ${b.event}`,
      })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let cumPnl = 0;
    for (const e of allEvents) {
      cumPnl += e.pnl;
      pnlHistory.push({
        date: e.date,
        pnl: parseFloat(e.pnl.toFixed(2)),
        cumPnl: parseFloat(cumPnl.toFixed(2)),
        market: e.market,
        label: e.label,
      });
    }

    res.json({
      totalCapital: parseFloat(totalCapital.toFixed(2)),
      totalDayPnl: parseFloat(totalPnl.toFixed(2)),
      totalRealizedPnl: parseFloat(totalRealizedPnl.toFixed(2)),

      equities: {
        value: parseFloat(equityValue.toFixed(2)),
        dayPnl: parseFloat(equityDayPnl.toFixed(2)),
        unrealizedPnl: parseFloat(equityUnrealizedPnl.toFixed(2)),
        realizedPnl: parseFloat(equityRealizedPnl.toFixed(2)),
        positions: equityPositions,
        openTrades: openTrades.length,
        closedTrades: closedTrades.length,
      },

      sports: {
        atRisk: parseFloat(sportsAtRisk.toFixed(2)),
        totalStaked: parseFloat(sportsTotalStaked.toFixed(2)),
        totalResult: parseFloat(sportsTotalResult.toFixed(2)),
        roi: parseFloat(sportsROI.toFixed(2)),
        winRate: parseFloat((sportsWinRate * 100).toFixed(1)),
        pendingBets: pendingBets.length,
        settledBets: settledBets.length,
        wins: sportsWins,
        losses: sportsLosses,
      },

      allocation: {
        equities: totalCapital > 0 ? parseFloat(((equityValue / totalCapital) * 100).toFixed(1)) : 0,
        sports: totalCapital > 0 ? parseFloat(((sportsAtRisk / totalCapital) * 100).toFixed(1)) : 0,
      },

      pnlHistory,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Capital allocation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
