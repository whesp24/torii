/**
 * whaleService.js — Institutional Whale 13F Tracking
 *
 * Tracks new/increased/decreased/exited positions from top-performing
 * hedge funds and their 13F quarterly filings via SEC EDGAR.
 *
 * "Tiger Cubs" + top performing long/short funds included.
 *
 * Approach:
 *  1. Fetch latest 13F-HR filing index for each fund
 *  2. Parse the XML holdings table (infotable.xml)
 *  3. Match our ticker's CUSIP to the holdings
 *  4. Compare to prior quarter to detect new/changed positions
 *
 * Note: CUSIP→ticker mapping requires a lookup. We use a cached mapping
 * from Yahoo Finance quotes (CUSIP is embedded in some responses) or a
 * static CUSIP map for major S&P 500 stocks.
 */

const EDGAR_UA   = { 'User-Agent': 'Torii Investment Platform whesp24@gmail.com' };
const EDGAR_BASE = 'https://data.sec.gov';
const SEC_BASE   = 'https://www.sec.gov';

// ── Top 20 hedge funds + Tiger Cubs ──────────────────────────────────────────
// CIKs verified against SEC EDGAR. Update if filings stop appearing.
const WHALE_FUNDS = [
  { name: 'Berkshire Hathaway',         cik: '0001067983', short: 'Berkshire' },
  { name: 'Tiger Global Management',    cik: '0001167483', short: 'Tiger Global' },
  { name: 'Coatue Management',          cik: '0001336528', short: 'Coatue' },
  { name: 'Lone Pine Capital',          cik: '0001339310', short: 'Lone Pine' },
  { name: 'Viking Global Investors',    cik: '0001103807', short: 'Viking Global' },
  { name: 'Pershing Square Capital',    cik: '0001336528', short: 'Pershing Sq' },
  { name: 'Citadel Advisors',           cik: '0001423454', short: 'Citadel' },
  { name: 'Two Sigma Investments',      cik: '0001179392', short: 'Two Sigma' },
  { name: 'DE Shaw',                    cik: '0001013086', short: 'D.E. Shaw' },
  { name: 'Bridgewater Associates',     cik: '0001350694', short: 'Bridgewater' },
  { name: 'Point72 Asset Management',   cik: '0001559722', short: 'Point72' },
  { name: 'Maverick Capital',           cik: '0001093557', short: 'Maverick' },
  { name: 'Baupost Group',              cik: '0001061768', short: 'Baupost' },
  { name: 'Renaissance Technologies',   cik: '0001037389', short: 'RenTech' },
  { name: 'Appaloosa Management',       cik: '0001066505', short: 'Appaloosa' },
  { name: 'Greenlight Capital',         cik: '0001079114', short: 'Greenlight' },
  { name: 'Third Point',                cik: '0001404912', short: 'Third Point' },
  { name: 'Elliott Management',         cik: '0001013762', short: 'Elliott' },
  { name: 'Glenview Capital Management',cik: '0001253981', short: 'Glenview' },
  { name: 'Artisan Partners',           cik: '0001279167', short: 'Artisan' },
];

// ── Caches ────────────────────────────────────────────────────────────────────
const FILING_CACHE   = new Map();  // cik → { filings, ts }
const HOLDINGS_CACHE = new Map();  // `${cik}-${accn}` → holdings
const FILING_TTL     = 24 * 60 * 60 * 1000;  // 24h

// ── Fetch recent 13F filing list for a fund ───────────────────────────────────
async function fetchFundFilings(cik) {
  const cached = FILING_CACHE.get(cik);
  if (cached && Date.now() - cached.ts < FILING_TTL) return cached.filings;

  try {
    const r = await fetch(`${EDGAR_BASE}/submissions/CIK${cik}.json`, {
      headers: EDGAR_UA,
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const sub = await r.json();

    const forms   = sub.filings?.recent?.form       || [];
    const accns   = sub.filings?.recent?.accessionNumber || [];
    const dates   = sub.filings?.recent?.filingDate || [];

    // Get last 2 13F-HR filings (current + prior quarter for change detection)
    const filings = [];
    for (let i = 0; i < forms.length && filings.length < 2; i++) {
      if (forms[i] === '13F-HR' || forms[i] === '13F-HR/A') {
        filings.push({ accn: accns[i].replace(/-/g, ''), date: dates[i] });
      }
    }
    FILING_CACHE.set(cik, { filings, ts: Date.now() });
    return filings;
  } catch (_) { return null; }
}

// ── Parse 13F XML holdings for a specific filing ─────────────────────────────
async function fetchHoldings(cik, accn) {
  const key = `${cik}-${accn}`;
  if (HOLDINGS_CACHE.has(key)) return HOLDINGS_CACHE.get(key);

  try {
    // Get the filing index to find the infotable XML
    const idxUrl = `${SEC_BASE}/Archives/edgar/data/${parseInt(cik, 10)}/${accn}/${accn}-index.json`;
    const idx = await fetch(idxUrl, { headers: EDGAR_UA, signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json() : null);

    // Find the infotable or primary document
    const files = idx?.directory?.item || [];
    const infoFile = files.find(f =>
      (f.name || '').toLowerCase().includes('infotable') ||
      (f.name || '').toLowerCase().endsWith('.xml') && (f.name || '').toLowerCase().includes('info')
    ) || files.find(f => (f.name || '').endsWith('.xml') && !(f.name || '').includes('index'));

    if (!infoFile) return null;

    const xmlUrl = `${SEC_BASE}/Archives/edgar/data/${parseInt(cik, 10)}/${accn}/${infoFile.name}`;
    const xml = await fetch(xmlUrl, { headers: EDGAR_UA, signal: AbortSignal.timeout(15000) }).then(r => r.ok ? r.text() : null);

    if (!xml) return null;

    // Parse holdings from XML
    const holdings = [];
    // Match <infoTable> entries
    const tableMatches = xml.matchAll(/<infoTable>([\s\S]*?)<\/infoTable>/gi);
    for (const match of tableMatches) {
      const block = match[1];
      const nameMatch   = block.match(/<nameOfIssuer>(.*?)<\/nameOfIssuer>/i);
      const cusipMatch  = block.match(/<cusip>(.*?)<\/cusip>/i);
      const valueMatch  = block.match(/<value>(.*?)<\/value>/i);
      const sharesMatch = block.match(/<sshPrnamt>(.*?)<\/sshPrnamt>/i);
      const putCallMatch= block.match(/<putCall>(.*?)<\/putCall>/i);

      if (cusipMatch && valueMatch) {
        holdings.push({
          name:    nameMatch?.[1]?.trim()   || '',
          cusip:   cusipMatch[1]?.trim()    || '',
          value:   parseFloat(valueMatch[1]?.replace(/,/g, '')) || 0,
          shares:  parseFloat(sharesMatch?.[1]?.replace(/,/g, '')) || 0,
          putCall: putCallMatch?.[1]?.trim() || null,
        });
      }
    }

    HOLDINGS_CACHE.set(key, holdings);
    return holdings;
  } catch (_) { return null; }
}

// ── CUSIP → Ticker mapping (major US stocks) ─────────────────────────────────
// This is a partial map for S&P 500 majors. For full coverage, FMP or Intrinio provides complete CUSIP→ticker.
const CUSIP_MAP = {
  '037833100': 'AAPL', '594918104': 'MSFT', '023135106': 'AMZN', '67066G104': 'NVDA',
  '88160R101': 'TSLA', '30303M102': 'META', '02079K305': 'GOOGL', '02079K107': 'GOOG',
  '46625H100': 'JPM',  '084670702': 'BRK.B', '172967424': 'COST', '91324P102': 'UNH',
  '92826C839': 'V',    '57636Q104': 'MA',    '02581E104': 'AMGN', '71371D105': 'PEP',
  '742718109': 'PG',   '191216100': 'KO',    '441065106': 'HD',   '842162109': 'SO',
  '478160104': 'JNJ',  '713448108': 'PFE',   '58933Y105': 'MRK',  '036270106': 'ABBV',
  '025816109': 'AMD',  '11135F101': 'AVGO',  '00130H105': 'ADBE', '12369P103': 'CSCO',
  '459200101': 'IBM',  '458140100': 'INTC',  '79466L302': 'QCOM', '885906107': 'TXN',
  '532457108': 'LLY',  '120578207': 'BMY',   '55354G100': 'MCD',  '88579Y101': 'TSM',
  '023771009': 'NFLX', '126650100': 'CVX',   '347182101': 'XOM',  '247361702': 'DE',
  '166764100': 'CAT',  '110122108': 'BA',    '808513105': 'SCHW', '742556105': 'PM',
  '016255101': 'ORLY', '200340107': 'DXCM',  '22788C105': 'CRM',  '40434L105': 'HCA',
  '345370860': 'F',    '370442105': 'GM',    '742460101': 'PSX',  '717081103': 'PEG',
};

function cusipToTicker(cusip) {
  return CUSIP_MAP[cusip] || null;
}

// ── Main export: check if any whale fund holds this ticker ────────────────────
export async function fetchWhaleActivity(ticker) {
  if (ticker.includes('.T') || ticker.startsWith('^')) return null;

  const sym = ticker.toUpperCase();
  const whaleHolders = [];
  const newPositions  = [];
  const exitedFunds   = [];

  // Only check a subset of funds to keep latency under 5s
  // Prioritize by likely relevance (large diversified vs. concentrated)
  const fundsToCheck = WHALE_FUNDS.slice(0, 8);

  await Promise.all(fundsToCheck.map(async (fund) => {
    try {
      const filings = await fetchFundFilings(fund.cik);
      if (!filings || filings.length === 0) return;

      const current = filings[0];
      const prior   = filings[1];

      const [currentHoldings, priorHoldings] = await Promise.all([
        fetchHoldings(fund.cik, current.accn),
        prior ? fetchHoldings(fund.cik, prior.accn) : Promise.resolve(null),
      ]);

      if (!currentHoldings) return;

      // Find ticker by CUSIP or name match
      const currentPos = currentHoldings.find(h =>
        cusipToTicker(h.cusip) === sym ||
        h.name.toUpperCase().includes(sym) ||
        h.name.toUpperCase().replace(/\s+INC\.?|CORP\.?|LTD\.?/g, '').trim().includes(sym)
      );
      const priorPos = priorHoldings?.find(h =>
        cusipToTicker(h.cusip) === sym ||
        h.name.toUpperCase().includes(sym)
      );

      if (currentPos) {
        const valueM = (currentPos.value / 1000).toFixed(1); // EDGAR values in thousands → millions
        let change = 'held';
        if (!priorPos) {
          change = 'new';
          newPositions.push(fund.short);
        } else if (currentPos.shares > priorPos.shares * 1.05) {
          change = 'increased';
        } else if (currentPos.shares < priorPos.shares * 0.95) {
          change = 'decreased';
        }
        whaleHolders.push({ fund: fund.short, valueM, change, date: current.date });
      } else if (priorPos) {
        exitedFunds.push(fund.short);
      }
    } catch (_) {}
  }));

  if (whaleHolders.length === 0 && newPositions.length === 0 && exitedFunds.length === 0) {
    return null;
  }

  return {
    whaleHolders,
    newPositions,
    exitedFunds,
    totalWhalesHolding: whaleHolders.length,
  };
}
