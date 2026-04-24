import express from 'express';
import News from '../models/News.js';

const router = express.Router();

// ── Extended-thinking LLM call (Anthropic Opus preferrred, Gemini fallback) ──
async function callDeepResearch(prompt) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const GEMINI_KEY    = process.env.GEMINI_API_KEY;

  // Anthropic claude-opus-4-5 with extended thinking
  if (ANTHROPIC_KEY) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 16000,
        thinking: { type: 'enabled', budget_tokens: 8000 },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Anthropic deep research error:', err);
      throw new Error(`Anthropic API error: ${res.status}`);
    }
    const data = await res.json();
    const thinking = data.content?.find(b => b.type === 'thinking')?.thinking || null;
    const text     = data.content?.find(b => b.type === 'text')?.text || '';
    return { memo: text, thinking, model: 'claude-opus-4-5 (extended thinking)' };
  }

  // Gemini fallback (no extended thinking, but deep prompt)
  if (GEMINI_KEY) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { memo: text, thinking: null, model: 'gemini-1.5-flash' };
  }

  // Mock fallback
  return {
    memo: `# Investment Memo: Demo Mode\n\nNo API key configured. Add ANTHROPIC_API_KEY or GEMINI_API_KEY to Render environment variables to enable deep research.\n\n## What you'd get:\n- Full investment thesis with bull/bear cases\n- Fundamental analysis (revenue, margins, FCF)\n- Competitive position and moat assessment\n- Top 5 risk factors with probability estimates\n- Geopolitical and macro exposure\n- Catalysts (3-6m and 12m+)\n- Valuation vs peers and historical range\n- Verdict with price target range`,
    thinking: null,
    model: 'mock',
  };
}

// POST /api/deepresearch — full deep dive on a ticker
router.post('/', async (req, res) => {
  try {
    const { ticker, question } = req.body;
    if (!ticker) return res.status(400).json({ error: 'ticker required' });
    const sym = ticker.toUpperCase();

    // Gather all available context from existing DB data
    const [recentNews, recentInsider] = await Promise.allSettled([
      News.find({ $or: [{ ticker: sym }, { headline: new RegExp(sym, 'i') }] })
        .sort({ createdAt: -1 }).limit(15)
        .select('headline summary sentiment createdAt source').lean(),
      // Try to import insider model if available
      import('../models/InsiderTrade.js').then(m =>
        m.default.find({ ticker: sym }).sort({ filingDate: -1 }).limit(10)
          .select('insiderName role transactionType shares value filingDate').lean()
      ).catch(() => []),
    ]);

    const news    = recentNews.status    === 'fulfilled' ? recentNews.value    : [];
    const insider = recentInsider.status === 'fulfilled' ? recentInsider.value : [];

    const newsBlock = news.length > 0
      ? news.map(n => `• [${n.sentiment || 'neutral'}] ${n.headline}`).join('\n')
      : 'No recent news in database.';

    const insiderBlock = insider.length > 0
      ? insider.map(i => `• ${i.insiderName} (${i.role}): ${i.transactionType} ${i.shares?.toLocaleString()} shares ($${(i.value/1e6)?.toFixed(1)}M) on ${i.filingDate?.toISOString()?.slice(0,10)}`).join('\n')
      : 'No recent insider data.';

    const prompt = `You are a senior equity analyst at a top-tier hedge fund with access to all public data. Conduct a comprehensive deep-dive research memo.

TICKER: ${sym}
RESEARCH QUESTION: ${question || `Full investment analysis and thesis for ${sym}`}

RECENT NEWS CONTEXT (from Torii database):
${newsBlock}

INSIDER TRADING CONTEXT:
${insiderBlock}

Write a complete institutional-grade investment memo structured exactly as follows:

# ${sym} — Deep Research Memo

## Executive Summary
2-3 sentence verdict with price target range and conviction level (1-10).

## Investment Thesis
Bull case and bear case in 2-3 paragraphs each. Identify the key variant view — what does the market have wrong?

## Fundamental Analysis
Revenue growth trajectory, margin profile, FCF generation, balance sheet strength, capital allocation quality. Use specific numbers where available.

## Competitive Position
Moat assessment, market share dynamics, key competitive threats, switching costs, network effects if any.

## Geopolitical & Macro Exposure
Specific macro tailwinds and headwinds. Rate sensitivity. Supply chain geography. Regulatory risks.

## Risk Factors
Top 5 risks with estimated probability (%) and potential impact (high/med/low):
1.
2.
3.
4.
5.

## Catalysts
Near-term (0-6 months): specific events that could move the stock ±10%+
Long-term (6-18 months): structural catalysts for re-rating

## Valuation
Current multiple vs 5-year historical range vs peer group. Fair value methodology. Bull/base/bear scenario price targets.

## Second-Order Thinking
What non-obvious effects, beneficiaries, or risks does the market miss? What would change your thesis?

## Verdict
BUY / HOLD / SELL with conviction (1-10), entry range, price target, stop loss, timeframe.

Be specific. Cite data. Show your reasoning. This memo will be presented to an investment committee.`;

    const result = await callDeepResearch(prompt);

    const sources = [
      news.length > 0    ? `${news.length} recent news items`    : null,
      insider.length > 0 ? `${insider.length} insider transactions` : null,
      'AI extended analysis',
      'Torii database',
    ].filter(Boolean);

    res.json({
      ticker: sym,
      question: question || `Full analysis for ${sym}`,
      ...result,
      sources,
      generatedAt: new Date(),
    });
  } catch (error) {
    console.error('Deep research error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
