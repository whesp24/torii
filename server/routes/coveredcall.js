import express from 'express';
import * as yahooClient from '../lib/yahooClient.js';

const router = express.Router();

// Helper function: Black-Scholes approximation for IV estimation
function estimateIV(S, K, T, r = 0.05) {
  const d = Math.abs(Math.log(S / K)) / Math.sqrt(T);
  return Math.max(0.1, Math.min(0.8, d / (2 * Math.sqrt(T))));
}

// Helper function: Rough premium estimate when real options data unavailable
function estimateOptionPremium(currentPrice, strike, daysToExpiry, iv) {
  const T = daysToExpiry / 365;
  const moneyness = strike / currentPrice;
  const volatility = iv || 0.3;

  // Simplified Black-Scholes call premium approximation
  const d1Numerator = Math.log(1 / moneyness) + (0.5 * volatility * volatility) * T;
  const d1 = d1Numerator / (volatility * Math.sqrt(T));

  // Approximation of normal CDF
  const cdf = 0.5 * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (d1 - d1 * d1 * d1 / 6)));

  const premium =
    currentPrice * cdf * Math.exp(-0.5 * volatility * volatility * T) -
    strike * cdf * Math.exp(-0.05 * T);

  // Add randomness for variation (rough estimate)
  const randomFactor = 1 + (Math.random() - 0.5) * 0.3;
  return Math.max(0.05, premium * randomFactor);
}

// POST /coveredcall/analyze - Analyze covered call opportunities
router.post('/analyze', async (req, res) => {
  try {
    const { ticker, shares, currentPrice, targetExit, daysToExpiry } = req.body;

    // Validate inputs
    if (!ticker || !shares || !currentPrice || !targetExit || !daysToExpiry) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: ticker, shares, currentPrice, targetExit, daysToExpiry',
      });
    }

    const tickerUpper = ticker.toUpperCase();
    const sharesNum = Number(shares);
    const currentPriceNum = Number(currentPrice);
    const targetExitNum = Number(targetExit);
    const daysToExpiryNum = Number(daysToExpiry);

    if (sharesNum <= 0 || currentPriceNum <= 0 || daysToExpiryNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'shares, currentPrice, and daysToExpiry must be positive numbers',
      });
    }

    // Define strike levels relative to targetExit
    const strikeOffsets = [0.95, 0.9, 0.85]; // 5%, 10%, 15% below target exit
    const strikes = strikeOffsets.map(offset => targetExitNum * offset);

    let callOptions = [];

    try {
      // Try to fetch real options data from Yahoo
      // yahooClient.options() returns the unwrapped chain directly:
      // { calls, puts, expirationDates, strikes, underlyingSymbol, quote }
      const optionsData = await yahooClient.options(tickerUpper);

      if (optionsData && optionsData.expirationDates && optionsData.calls) {
        const expirations = optionsData.expirationDates || [];

        // Find expiration date closest to daysToExpiry
        const targetDate = new Date(Date.now() + daysToExpiryNum * 24 * 60 * 60 * 1000);
        const closestExpiration = expirations.length ? expirations.reduce((prev, curr) => {
          const currDate = new Date(curr * 1000);
          const prevDate = new Date(prev * 1000);
          return Math.abs(currDate - targetDate) < Math.abs(prevDate - targetDate) ? curr : prev;
        }) : null;

        if (closestExpiration) {
          const chainData = optionsData.calls || [];

          // Filter calls matching our strike criteria
          for (const strike of strikes) {
            const matchingCalls = chainData.filter(
              call =>
                Math.abs(call.strike - strike) < strike * 0.02 && // Within 2% of target strike
                call.bid > 0 &&
                call.ask > 0
            );

            for (const call of matchingCalls.slice(0, 1)) {
              const premium = (call.bid + call.ask) / 2;
              const actualDaysToExpiry = Math.ceil(
                (closestExpiration * 1000 - Date.now()) / (24 * 60 * 60 * 1000)
              );

              const annualizedYield = (premium / currentPriceNum) * (365 / actualDaysToExpiry) * 100;
              const moneyness = currentPriceNum / call.strike;
              const probabilityAssignment = Math.max(0.3, Math.min(0.95, 1 / (1 + Math.exp(-5 * (moneyness - 1.0)))));

              callOptions.push({
                strike: call.strike,
                expiry: new Date(closestExpiration * 1000).toISOString().split('T')[0],
                premium: premium.toFixed(2),
                bid: call.bid.toFixed(2),
                ask: call.ask.toFixed(2),
                annualizedYield: annualizedYield.toFixed(2),
                probabilityAssignment: (probabilityAssignment * 100).toFixed(1),
                premiumTotal: (premium * sharesNum * 100).toFixed(2),
                assignmentPrice: (call.strike * 100).toFixed(2),
                openInterest: call.openInterest || 0,
                volume: call.volume || 0,
              });
            }
          }
        }
      }
    } catch (yahooErr) {
      console.log(`Could not fetch real options data from Yahoo: ${yahooErr.message}`);
    }

    // If no real options found, use estimates
    if (callOptions.length === 0) {
      const iv = estimateIV(currentPriceNum, strikes[0], daysToExpiryNum / 365);

      for (const strike of strikes) {
        const estimatedPremium = estimateOptionPremium(currentPriceNum, strike, daysToExpiryNum, iv);
        const annualizedYield = (estimatedPremium / currentPriceNum) * (365 / daysToExpiryNum) * 100;
        const moneyness = currentPriceNum / strike;
        const probabilityAssignment = Math.max(0.3, Math.min(0.95, 1 / (1 + Math.exp(-5 * (moneyness - 1.0)))));

        const expiryDate = new Date(Date.now() + daysToExpiryNum * 24 * 60 * 60 * 1000);

        callOptions.push({
          strike: strike.toFixed(2),
          expiry: expiryDate.toISOString().split('T')[0],
          premium: estimatedPremium.toFixed(2),
          bid: (estimatedPremium * 0.98).toFixed(2),
          ask: (estimatedPremium * 1.02).toFixed(2),
          annualizedYield: annualizedYield.toFixed(2),
          probabilityAssignment: (probabilityAssignment * 100).toFixed(1),
          premiumTotal: (estimatedPremium * sharesNum * 100).toFixed(2),
          assignmentPrice: (strike * 100).toFixed(2),
          openInterest: 0,
          volume: 0,
          isEstimated: true,
        });
      }
    }

    // Sort by annualized yield descending and return top 5
    const topCalls = callOptions
      .sort((a, b) => parseFloat(b.annualizedYield) - parseFloat(a.annualizedYield))
      .slice(0, 5);

    res.json({
      success: true,
      ticker: tickerUpper,
      currentPrice: currentPriceNum.toFixed(2),
      targetExit: targetExitNum.toFixed(2),
      shares: sharesNum,
      daysToExpiry: daysToExpiryNum,
      totalPositionValue: (sharesNum * currentPriceNum).toFixed(2),
      data: topCalls,
    });
  } catch (error) {
    console.error('Error analyzing covered calls:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /coveredcall/positions - Placeholder for user's current covered call positions
router.get('/positions', async (req, res) => {
  try {
    // Placeholder: return empty array
    // In production, would fetch from user's portfolio/positions database
    res.json({
      success: true,
      data: [],
      message: 'No active covered call positions',
    });
  } catch (error) {
    console.error('Error fetching covered call positions:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
