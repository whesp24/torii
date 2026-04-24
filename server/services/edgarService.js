/**
 * edgarService.js — SEC EDGAR XBRL API
 *
 * Free, official, unlimited. Provides:
 *  • Free cash flow (Operating CF − Capex) — 8 quarters
 *  • Revenue trend — 8 quarters
 *  • Net debt (Total Debt − Cash)
 *  • Debt/Equity, Interest Coverage
 *  • Shares outstanding
 *
 * Rate limit: 10 req/sec per SEC fair-use policy.
 * User-Agent must identify requester per SEC requirements.
 */

const EDGAR_UA = { 'User-Agent': 'Torii Investment Platform whesp24@gmail.com' };
const EDGAR_BASE = 'https://data.sec.gov';
const SEC_BASE   = 'https://www.sec.gov';

// ── In-memory caches ──────────────────────────────────────────────────────────
const CIK_CACHE   = new Map();  // ticker → padded CIK
const FACTS_CACHE = new Map();  // cik → { data, ts }
const FACTS_TTL   = 24 * 60 * 60 * 1000; // 24h — EDGAR data changes at most quarterly

// ── CIK lookup from SEC company_tickers.json ─────────────────────────────────
let _tickerMap = null;
let _tickerMapTs = 0;

async function loadTickerMap() {
  if (_tickerMap && Date.now() - _tickerMapTs < 12 * 60 * 60 * 1000) return _tickerMap;
  try {
    const r = await fetch(`${SEC_BASE}/files/company_tickers.json`, {
      headers: EDGAR_UA,
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const raw = await r.json();
    _tickerMap = {};
    for (const key in raw) {
      const t = (raw[key].ticker || '').toUpperCase();
      const cik = String(raw[key].cik_str).padStart(10, '0');
      if (t) _tickerMap[t] = cik;
    }
    _tickerMapTs = Date.now();
    return _tickerMap;
  } catch (_) { return null; }
}

export async function tickerToCIK(ticker) {
  const sym = ticker.toUpperCase().replace(/\.[A-Z]+$/, ''); // strip .T suffix
  if (CIK_CACHE.has(sym)) return CIK_CACHE.get(sym);
  const map = await loadTickerMap();
  if (!map) return null;
  const cik = map[sym] || null;
  if (cik) CIK_CACHE.set(sym, cik);
  return cik;
}

// ── Fetch company facts (XBRL) with cache ────────────────────────────────────
async function fetchCompanyFacts(cik) {
  const cached = FACTS_CACHE.get(cik);
  if (cached && Date.now() - cached.ts < FACTS_TTL) return cached.data;

  try {
    const r = await fetch(`${EDGAR_BASE}/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: EDGAR_UA,
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    FACTS_CACHE.set(cik, { data, ts: Date.now() });
    return data;
  } catch (_) { return null; }
}

// ── Extract recent values for a GAAP concept ─────────────────────────────────
// Returns an array of { end, val, form } sorted ascending by date.
// Prefers annual (10-K) values; falls back to quarterly (10-Q).
function extractValues(facts, ...conceptNames) {
  const usGaap = facts?.facts?.['us-gaap'] || {};
  for (const conceptName of conceptNames) {
    const concept = usGaap[conceptName];
    if (!concept) continue;
    const usd = concept.units?.USD || concept.units?.shares || Object.values(concept.units || {})[0];
    if (!usd || !Array.isArray(usd)) continue;

    // Annual 10-K values
    const annual = usd
      .filter(v => v.form === '10-K' && v.val != null && v.end)
      .sort((a, b) => a.end.localeCompare(b.end))
      .slice(-8);

    if (annual.length >= 1) return annual;

    // Quarterly 10-Q fallback — de-duplicate by period end
    const seen = new Set();
    const quarterly = usd
      .filter(v => (v.form === '10-Q' || v.form === '10-K') && v.val != null && v.end && !seen.has(v.end) && seen.add(v.end))
      .sort((a, b) => a.end.localeCompare(b.end))
      .slice(-8);

    if (quarterly.length >= 1) return quarterly;
  }
  return [];
}

function latestVal(facts, ...conceptNames) {
  const vals = extractValues(facts, ...conceptNames);
  return vals.length > 0 ? vals[vals.length - 1].val : null;
}

// ── Compute FCF CAGR from historical data ─────────────────────────────────────
function computeCAGR(values) {
  if (!values || values.length < 2) return null;
  const first = values[0].val;
  const last  = values[values.length - 1].val;
  const years = values.length - 1; // rough: one value per period
  if (!first || first <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

// ── Main export: get EDGAR fundamentals for a ticker ─────────────────────────
export async function getEDGARFundamentals(ticker) {
  // Strip TSE suffix — EDGAR only covers US companies
  if (ticker.includes('.T')) return null;

  try {
    const cik = await tickerToCIK(ticker);
    if (!cik) return null;

    const facts = await fetchCompanyFacts(cik);
    if (!facts) return null;

    // Operating Cash Flow
    const ocfVals = extractValues(facts,
      'NetCashProvidedByUsedInOperatingActivities',
      'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'
    );
    // Capital Expenditures (reported as negative outflow — abs it)
    const capexVals = extractValues(facts,
      'PaymentsToAcquirePropertyPlantAndEquipment',
      'CapitalExpendituresIncurredButNotYetPaid',
      'PurchaseOfPropertyPlantAndEquipment'
    );
    // Revenue
    const revVals = extractValues(facts,
      'Revenues',
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'SalesRevenueNet',
      'RevenueFromContractWithCustomerIncludingAssessedTax'
    );
    // Net Income
    const niVals = extractValues(facts,
      'NetIncomeLoss',
      'NetIncomeLossAttributableToParent'
    );
    // Cash & equivalents
    const cashVal = latestVal(facts,
      'CashAndCashEquivalentsAtCarryingValue',
      'CashCashEquivalentsAndShortTermInvestments'
    );
    // Total debt
    const debtVal = latestVal(facts,
      'LongTermDebtAndCapitalLeaseObligations',
      'LongTermDebt',
      'LongTermDebtNoncurrent',
      'DebtAndCapitalLeaseObligations'
    );
    // Short-term debt
    const stDebtVal = latestVal(facts,
      'ShortTermBorrowings',
      'LongTermDebtCurrent',
      'NotesPayableCurrent'
    );
    // Total Assets & Equity for D/E ratio
    const totalAssetsVal = latestVal(facts, 'Assets');
    const equityVal = latestVal(facts,
      'StockholdersEquity',
      'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'
    );
    // Shares outstanding
    const sharesVal = latestVal(facts,
      'CommonStockSharesOutstanding',
      'CommonStockSharesIssued'
    );
    // Interest expense for coverage ratio
    const intExpVal = latestVal(facts,
      'InterestExpense',
      'InterestAndDebtExpense'
    );
    // EBIT (Operating income)
    const ebitVal = latestVal(facts,
      'OperatingIncomeLoss',
      'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest'
    );

    // ── Compute FCF ───────────────────────────────────────────────────────────
    const fcfVals = [];
    const minLen = Math.min(ocfVals.length, capexVals.length > 0 ? ocfVals.length : 0);
    for (let i = 0; i < ocfVals.length; i++) {
      const ocf = ocfVals[i].val;
      // Match capex by period end (or use last known)
      const capexEntry = capexVals.find(c => c.end === ocfVals[i].end) || capexVals[capexVals.length - 1];
      const capex = capexEntry ? Math.abs(capexEntry.val) : 0;
      fcfVals.push({ end: ocfVals[i].end, val: ocf - capex, form: ocfVals[i].form });
    }

    const latestFCF = fcfVals.length > 0 ? fcfVals[fcfVals.length - 1].val : null;
    const latestOCF = ocfVals.length  > 0 ? ocfVals[ocfVals.length - 1].val   : null;
    const latestRev = revVals.length  > 0 ? revVals[revVals.length - 1].val    : null;
    const prevRev   = revVals.length  > 1 ? revVals[revVals.length - 2].val    : null;

    // Revenue growth YoY from EDGAR
    const edgarRevGrowth = latestRev && prevRev && prevRev > 0
      ? ((latestRev - prevRev) / prevRev) * 100
      : null;

    // FCF margin
    const fcfMargin = latestFCF != null && latestRev && latestRev > 0
      ? (latestFCF / latestRev) * 100
      : null;

    // FCF CAGR (historical trend)
    const fcfCAGR = computeCAGR(fcfVals.filter(v => v.val > 0));

    // Net debt
    const totalDebt = (debtVal || 0) + (stDebtVal || 0);
    const netDebt   = totalDebt - (cashVal || 0);

    // Debt/Equity
    const debtToEquity = equityVal && equityVal > 0 ? totalDebt / equityVal : null;

    // Interest coverage (EBIT / Interest Expense)
    const interestCoverage = ebitVal && intExpVal && intExpVal > 0
      ? ebitVal / intExpVal
      : null;

    // FCF trend: is FCF growing?
    let fcfTrend = null;
    if (fcfVals.length >= 3) {
      const recent = fcfVals.slice(-3).map(v => v.val);
      const isGrowing  = recent[2] > recent[1] && recent[1] > recent[0];
      const isDeclining = recent[2] < recent[1] && recent[1] < recent[0];
      fcfTrend = isGrowing ? 'growing' : isDeclining ? 'declining' : 'mixed';
    }

    return {
      // FCF
      latestFCF,         // in dollars (raw)
      fcfVals,           // array of { end, val } — last 8 periods
      fcfMargin,         // % of revenue
      fcfCAGR,           // annualized growth rate of positive FCF
      fcfTrend,          // 'growing' | 'declining' | 'mixed' | null
      // Revenue
      latestRev,
      revVals,
      edgarRevGrowth,    // YoY % from EDGAR (independent of Yahoo)
      // Profitability
      latestOCF,
      latestNI: niVals.length > 0 ? niVals[niVals.length - 1].val : null,
      // Balance sheet
      cash: cashVal,
      totalDebt,
      netDebt,           // positive = more debt than cash (levered)
      debtToEquity,
      interestCoverage,
      totalAssets: totalAssetsVal,
      equity: equityVal,
      sharesOutstanding: sharesVal,
      // Raw for DCF
      ocfVals,
    };
  } catch (err) {
    console.warn(`EDGAR fetch failed for ${ticker}: ${err.message}`);
    return null;
  }
}
