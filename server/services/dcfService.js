/**
 * dcfService.js — Standardized DCF Intrinsic Value Calculator
 *
 * Methodology:
 *  • FCF projection: 5-year using blended growth rate (60% analyst estimate + 40% historical CAGR)
 *  • Fade: Year 4-5 growth rate halved to reflect mean-reversion
 *  • Terminal value: Perpetuity growth at 2.5% (long-run GDP proxy)
 *  • WACC: Risk-free rate (4.5% proxy for US 10yr) + Beta × Equity Risk Premium (5.5%)
 *  • Enterprise Value → Equity Value via Net Debt adjustment
 *
 * Grounded in:
 *  Damodaran (2002) "Investment Valuation", "The Little Book of Valuation"
 *  Fama & French (1992): value premium — stocks below intrinsic value outperform
 */

const RISK_FREE_RATE      = 0.045;  // ~10yr Treasury yield proxy (update periodically)
const EQUITY_RISK_PREMIUM = 0.055;  // historical US equity risk premium
const TERMINAL_GROWTH     = 0.025;  // long-run perpetuity growth (GDP proxy)
const DEFAULT_BETA        = 1.0;    // assume market beta if unknown

/**
 * Compute WACC from Yahoo summary data.
 * WACC = Rf + Beta × (Rm − Rf)
 * (Simplified equity-only WACC — debt WACC requires cost of debt data)
 */
function computeWACC(beta) {
  const b = (beta != null && beta > 0 && beta < 5) ? beta : DEFAULT_BETA;
  return RISK_FREE_RATE + b * EQUITY_RISK_PREMIUM;
}

/**
 * Blend analyst growth estimate with historical FCF CAGR.
 * Weighted 60/40 toward analyst estimates (more forward-looking).
 * If only one source available, use that with lower confidence.
 */
function blendedGrowthRate(analystGrowth, historicalCAGR) {
  const ag = (analystGrowth != null && isFinite(analystGrowth)) ? analystGrowth / 100 : null;
  const hg = (historicalCAGR != null && isFinite(historicalCAGR)) ? historicalCAGR / 100 : null;

  if (ag != null && hg != null) return 0.6 * ag + 0.4 * hg;
  if (ag != null) return ag;
  if (hg != null) return hg;
  return null;
}

/**
 * Main DCF calculation.
 *
 * @param {Object} yfSummary — from fetchYahooSummary
 * @param {Object} edgar — from getEDGARFundamentals
 * @returns {Object|null} { intrinsicValue, currentPrice, upside, margin, confidence }
 */
export function computeDCF(yfSummary, edgar) {
  try {
    const currentPrice = yfSummary?.currentPrice;
    const shares       = edgar?.sharesOutstanding || (yfSummary?.marketCap && currentPrice ? yfSummary.marketCap / currentPrice : null);
    const latestFCF    = edgar?.latestFCF;

    // Need base FCF and shares to compute equity value
    if (!latestFCF || !shares || shares <= 0) return null;
    if (!currentPrice || currentPrice <= 0) return null;

    // Use positive FCF as starting point — negative FCF stocks are not suitable for DCF
    if (latestFCF <= 0) {
      return {
        intrinsicValue: null,
        currentPrice,
        upside: null,
        fcfBase: latestFCF,
        confidence: 'low',
        note: 'Negative FCF — DCF not applicable; use relative valuation',
      };
    }

    const wacc = computeWACC(yfSummary?.beta);

    // Blended growth: analyst earningsGrowth or revenueGrowth + historical FCF CAGR
    const analystGrowth   = yfSummary?.earningsGrowth ?? yfSummary?.revenueGrowth ?? null;
    const historicalCAGR  = edgar?.fcfCAGR ?? null;
    const growthRate      = blendedGrowthRate(analystGrowth, historicalCAGR);

    if (growthRate === null) return null;

    // Cap growth rate at reasonable bounds
    const g1 = Math.min(Math.max(growthRate, -0.10), 0.50);  // −10% to +50% for years 1-3
    const g2 = g1 * 0.5;                                       // fade to half for years 4-5

    // Project 5 years of FCF
    let projectedFCF = latestFCF;
    let sumPV = 0;

    for (let year = 1; year <= 5; year++) {
      const rate = year <= 3 ? g1 : g2;
      projectedFCF = projectedFCF * (1 + rate);
      const discountFactor = Math.pow(1 + wacc, year);
      sumPV += projectedFCF / discountFactor;
    }

    // Terminal value: FCF at year 5 grown by terminal rate, perpetuity
    if (wacc <= TERMINAL_GROWTH) return null; // math breaks down
    const terminalValue = (projectedFCF * (1 + TERMINAL_GROWTH)) / (wacc - TERMINAL_GROWTH);
    const pvTerminal    = terminalValue / Math.pow(1 + wacc, 5);

    // Enterprise value
    const ev = sumPV + pvTerminal;

    // Equity value = EV − Net Debt (net debt positive = reduces equity value)
    const netDebt     = edgar?.netDebt ?? 0;
    const equityValue = Math.max(0, ev - netDebt);

    // Per-share intrinsic value
    const intrinsicValue = equityValue / shares;

    const upside = ((intrinsicValue - currentPrice) / currentPrice) * 100;

    // Confidence based on data quality
    let confidence = 'high';
    if (!edgar?.fcfCAGR || !analystGrowth) confidence = 'medium';
    if (edgar?.fcfVals?.length < 3) confidence = 'low';

    return {
      intrinsicValue: parseFloat(intrinsicValue.toFixed(2)),
      currentPrice,
      upside: parseFloat(upside.toFixed(1)),
      fcfBase: latestFCF,
      growthRate: parseFloat((growthRate * 100).toFixed(1)),
      wacc: parseFloat((wacc * 100).toFixed(1)),
      terminalGrowth: TERMINAL_GROWTH * 100,
      confidence,
      note: null,
    };
  } catch (err) {
    console.warn(`DCF computation failed: ${err.message}`);
    return null;
  }
}

/**
 * Score the DCF result into a signal.
 * Returns { delta, direction, value } ready for gathered.push()
 */
export function scoreDCF(dcfResult) {
  if (!dcfResult) return null;

  if (dcfResult.note && !dcfResult.intrinsicValue) {
    return { delta: 0, direction: 'neutral', value: dcfResult.note };
  }

  const { upside, intrinsicValue, currentPrice, growthRate, wacc, confidence } = dcfResult;
  if (upside == null) return null;

  // Score based on margin of safety
  let delta = 0;
  if      (upside > 40)  delta = +12;
  else if (upside > 20)  delta = +8;
  else if (upside > 10)  delta = +5;
  else if (upside > 0)   delta = +2;
  else if (upside > -10) delta = -2;
  else if (upside > -25) delta = -6;
  else                   delta = -10;

  // Discount for low confidence
  if (confidence === 'low')    delta = Math.round(delta * 0.5);
  if (confidence === 'medium') delta = Math.round(delta * 0.75);

  const direction = delta >= 3 ? 'bullish' : delta <= -3 ? 'bearish' : 'neutral';
  const sign      = upside >= 0 ? '+' : '';
  const confNote  = confidence !== 'high' ? ` (${confidence} confidence)` : '';
  const value     = `$${intrinsicValue?.toFixed(2)} intrinsic · ${sign}${upside?.toFixed(0)}% vs market · WACC ${wacc?.toFixed(1)}% · growth ${growthRate > 0 ? '+' : ''}${growthRate?.toFixed(0)}%/yr${confNote}`;

  return { delta, direction, value };
}
