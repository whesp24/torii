/**
 * oddsService.js — The Odds API integration
 *
 * Free tier: 500 requests/month
 * Env var: ODDS_API_KEY (get free key at https://the-odds-api.com)
 *
 * Provides live odds + EV calculation for sports betting capital allocation.
 */

const BASE_URL = 'https://api.the-odds-api.com/v4';
const REGIONS = 'us';
const ODDS_FORMAT = 'american';

// Cache to conserve API calls (free tier = 500/mo)
let _oddsCache = {};
let _sportsList = null;
let _sportsListTs = 0;

export async function getSports() {
  const key = process.env.ODDS_API_KEY;
  if (!key) return getFallbackSports();

  // Cache sports list for 24 hours
  if (_sportsList && Date.now() - _sportsListTs < 24 * 60 * 60 * 1000) {
    return _sportsList;
  }

  try {
    const res = await fetch(`${BASE_URL}/sports/?apiKey=${key}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Odds API error: ${res.status}`);
    const data = await res.json();
    _sportsList = data.filter(s => s.active);
    _sportsListTs = Date.now();
    return _sportsList;
  } catch (err) {
    console.warn('Odds API getSports error:', err.message);
    return getFallbackSports();
  }
}

export async function getOdds(sportKey, markets = 'h2h') {
  const key = process.env.ODDS_API_KEY;
  if (!key) return [];

  const cacheKey = `${sportKey}_${markets}`;
  const cached = _oddsCache[cacheKey];
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
    return cached.data;
  }

  try {
    const res = await fetch(
      `${BASE_URL}/sports/${sportKey}/odds/?apiKey=${key}&regions=${REGIONS}&markets=${markets}&oddsFormat=${ODDS_FORMAT}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) throw new Error(`Odds API error: ${res.status}`);
    const data = await res.json();

    // Enrich with EV calculations
    const enriched = data.map(event => enrichEvent(event, markets));

    _oddsCache[cacheKey] = { data: enriched, ts: Date.now() };
    return enriched;
  } catch (err) {
    console.warn('Odds API getOdds error:', err.message);
    return cached?.data || [];
  }
}

function enrichEvent(event, market) {
  const bookmakers = event.bookmakers || [];
  if (bookmakers.length === 0) return { ...event, bestOdds: [], ev: null };

  // Find best odds across all books for each outcome
  const outcomeMap = {};
  for (const book of bookmakers) {
    for (const mkt of book.markets || []) {
      for (const outcome of mkt.outcomes || []) {
        const key = outcome.name + (outcome.point != null ? `_${outcome.point}` : '');
        if (!outcomeMap[key] || outcome.price > outcomeMap[key].price) {
          outcomeMap[key] = {
            name: outcome.name,
            point: outcome.point,
            price: outcome.price,
            book: book.title,
          };
        }
      }
    }
  }

  // Calculate no-vig probabilities from average across books
  const avgProbs = {};
  const counts = {};
  for (const book of bookmakers) {
    for (const mkt of book.markets || []) {
      for (const outcome of mkt.outcomes || []) {
        const key = outcome.name + (outcome.point != null ? `_${outcome.point}` : '');
        const prob = americanToProb(outcome.price);
        avgProbs[key] = (avgProbs[key] || 0) + prob;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  }

  // Remove vig by normalizing
  const rawProbs = {};
  let totalProb = 0;
  for (const key of Object.keys(avgProbs)) {
    rawProbs[key] = avgProbs[key] / counts[key];
    totalProb += rawProbs[key];
  }
  const fairProbs = {};
  for (const key of Object.keys(rawProbs)) {
    fairProbs[key] = rawProbs[key] / totalProb;
  }

  // Calculate EV for each outcome using best available odds
  const bestOdds = Object.values(outcomeMap).map(o => {
    const key = o.name + (o.point != null ? `_${o.point}` : '');
    const fairProb = fairProbs[key] || 0;
    const decimalOdds = americanToDecimal(o.price);
    const ev = (fairProb * (decimalOdds - 1)) - (1 - fairProb); // per $1 wagered
    return {
      ...o,
      fairProb: parseFloat(fairProb.toFixed(4)),
      impliedProb: parseFloat(americanToProb(o.price).toFixed(4)),
      ev: parseFloat(ev.toFixed(4)),
      evPct: parseFloat((ev * 100).toFixed(2)),
      isPositiveEV: ev > 0,
    };
  });

  return {
    id: event.id,
    sport: event.sport_key,
    sportTitle: event.sport_title,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    commenceTime: event.commence_time,
    bookmakerCount: bookmakers.length,
    bestOdds: bestOdds.sort((a, b) => b.ev - a.ev),
  };
}

function americanToProb(odds) {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

function americanToDecimal(odds) {
  if (odds > 0) return (odds / 100) + 1;
  return (100 / Math.abs(odds)) + 1;
}

function getFallbackSports() {
  return [
    { key: 'americanfootball_nfl', title: 'NFL', active: true },
    { key: 'basketball_nba', title: 'NBA', active: true },
    { key: 'baseball_mlb', title: 'MLB', active: true },
    { key: 'icehockey_nhl', title: 'NHL', active: true },
    { key: 'soccer_epl', title: 'EPL', active: true },
    { key: 'soccer_usa_mls', title: 'MLS', active: true },
    { key: 'mma_mixed_martial_arts', title: 'MMA', active: true },
    { key: 'tennis_atp_us_open', title: 'Tennis', active: true },
  ];
}
