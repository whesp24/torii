import AIThesis from '../models/AIThesis.js';
import UniversalScore from '../models/UniversalScore.js';
import News from '../models/News.js';

// ── Multi-provider LLM router ─────────────────────────────────────────────────
// Priority: Gemini (free) → Anthropic → Grok → mock
// Set ONE of: GEMINI_API_KEY, ANTHROPIC_API_KEY, or GROK_API_KEY in Render env vars

// Mutex — only one LLM call in flight at a time (prevents 429 storms on startup)
let _llmBusy = false;

async function callLLM(prompt) {
  // Serialise calls: if one is already in flight, wait up to 60s
  if (_llmBusy) {
    const start = Date.now();
    while (_llmBusy && Date.now() - start < 60000) {
      await new Promise(r => setTimeout(r, 2000));
    }
    if (_llmBusy) throw new Error('LLM busy — timeout waiting for prior call');
  }
  _llmBusy = true;
  try {
    return await _callLLMInner(prompt);
  } finally {
    _llmBusy = false;
  }
}

async function _callLLMInner(prompt) {
  const GEMINI_KEY    = process.env.GEMINI_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const GROK_KEY      = process.env.GROK_API_KEY;

  // ── Gemini (free tier: 1500 req/day on gemini-2.0-flash) ─────────────────
  if (GEMINI_KEY) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;
    // Retry up to 3× on 429 with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 15000 + Math.floor(Math.random() * 5000); // 15s, 30s + jitter
        console.warn(`Gemini 429 — retry ${attempt} in ${(delay/1000).toFixed(0)}s`);
        await new Promise(r => setTimeout(r, delay));
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (res.status === 429) continue; // backoff and retry
      if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    throw new Error('Gemini API error: 429 — rate limit exhausted after retries');
  }

  // ── Anthropic Claude Haiku (~$0.006/day at this usage) ───────────────────
  if (ANTHROPIC_KEY) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  // ── Grok xAI (free tier: 25 req/day) ─────────────────────────────────────
  if (GROK_KEY) {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
      }),
    });
    if (!res.ok) throw new Error(`Grok API error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  return null; // No API key configured
}

// Mutex — only one thesis generation run at a time
let _thesesRunning = false;

// Generate daily AI theses based on top-scored stocks and recent news
export async function generateDailyTheses() {
  if (_thesesRunning) {
    console.log('generateDailyTheses already running — skipping duplicate call');
    return [];
  }
  _thesesRunning = true;
  try {
    return await _generateDailyThesesInner();
  } finally {
    _thesesRunning = false;
  }
}

async function _generateDailyThesesInner() {
  try {
    const hasKey = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GROK_API_KEY;
    if (!hasKey) {
      console.warn('No LLM API key set (GEMINI_API_KEY, ANTHROPIC_API_KEY, or GROK_API_KEY). Returning mock theses.');
      return generateMockTheses();
    }

    // Fetch top 15 stocks by UniversalScore — fallback to curated list if DB empty
    let topScores = await UniversalScore.find({ lastScored: { $exists: true } })
      .sort({ score: -1 })
      .limit(15)
      .lean();

    if (!topScores || topScores.length === 0) {
      console.warn('UniversalScore empty — using curated fallback ticker list for thesis generation');
      topScores = [
        'NVDA','MSFT','GOOGL','META','AMZN','AAPL','TSM','AVGO','AMD','ASML',
        'TSLA','CRM','ORCL','ADBE','PLTR',
      ].map((ticker, i) => ({ ticker, score: 100 - i * 3 }));
    }

    // Fetch recent theses from last 24h to avoid repeats
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTheses = await AIThesis.find({ generatedAt: { $gte: oneDayAgo } })
      .select('ticker')
      .lean();
    const recentTickers = new Set(recentTheses.map(t => t.ticker));

    // Filter top scores to exclude recent ones
    const scoresToAnalyze = topScores
      .filter(s => !recentTickers.has(s.ticker))
      .slice(0, 10);

    if (scoresToAnalyze.length === 0) {
      console.log('All top tickers already analyzed in last 24h');
      return [];
    }

    // Fetch recent news (last 24h) for context
    const newsContext = await News.find({ createdAt: { $gte: oneDayAgo } })
      .select('headline ticker sentiment')
      .limit(20)
      .lean();

    // Build prompt for Claude
    const tickerContext = scoresToAnalyze
      .map(s => `${s.ticker}: score ${s.score}`)
      .join(', ');

    const newsContext_str = newsContext
      .map(n => `${n.ticker}: ${n.headline} (${n.sentiment || 'neutral'})`)
      .join('\n');

    const prompt = `You are a senior equity analyst at a quantitative hedge fund. Based on the following context, identify 4-5 compelling investment theses that demonstrate second-order reasoning and identify non-obvious plays.

Top Scored Tickers (by fundamental quality):
${tickerContext}

Recent Market News (last 24h):
${newsContext_str || 'No recent news available'}

For each thesis, generate a JSON object with:
- ticker: stock symbol
- headline: 1-line executive summary (10-15 words)
- thesis: 3-4 sentences of genuine analytical reasoning explaining the investment case
- whyNow: 1-2 sentences on catalysts and timing
- conviction: 1-10 scale (8+ = very high confidence)
- entry: reasonable entry price (as a number, realistic based on current fundamentals)
- target: upside price target (as a number)
- stop: downside stop loss (as a number)
- timeframe: "3-6 months", "6-12 months", or "12+ months"
- catalysts: array of 2-3 key catalysts (strings)
- riskFactors: array of 2-3 key risks (strings)
- dataPoints: array of 2-3 supporting data points (strings)
- sector: industry sector

Return ONLY a valid JSON array with no markdown, no explanation, no extra text. Example format:
[{"ticker":"NVDA","headline":"AI chip demand accelerates","thesis":"...","whyNow":"...","conviction":8,"entry":120.50,"target":165.00,"stop":105.00,"timeframe":"6-12 months","catalysts":["..."],"riskFactors":["..."],"dataPoints":["..."],"sector":"Semiconductors"}]`;

    const responseText = await callLLM(prompt);
    if (!responseText) throw new Error('LLM returned empty response');

    // Parse JSON array from response
    let theses;
    try {
      theses = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Claude response as JSON:', responseText);
      throw new Error('Claude response was not valid JSON');
    }

    if (!Array.isArray(theses)) {
      theses = [theses];
    }

    // Save theses to database
    const savedTheses = await Promise.all(
      theses.map(thesis =>
        AIThesis.create({
          ...thesis,
          status: 'pending',
          generatedAt: new Date(),
        })
      )
    );

    return savedTheses;
  } catch (error) {
    console.error('Error in _generateDailyThesesInner:', error.message);
    throw error;
  }
}

// Identify second-order beneficiaries of a macro theme
export async function getSecondOrderBeneficiaries(theme) {
  try {
    const hasKey = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GROK_API_KEY;
    if (!hasKey) return generateMockBeneficiaries(theme);

    // Fetch top 50 tickers by score
    const topTickers = await UniversalScore.find({ lastScored: { $exists: true } })
      .sort({ score: -1 })
      .limit(50)
      .select('ticker')
      .lean();

    const tickerList = topTickers.map(t => t.ticker).join(', ');

    const prompt = `You are a strategic equity analyst. Given the macro theme and universe of liquid stocks, identify 5 second-order beneficiaries — companies that benefit indirectly from the trend, not the obvious direct plays.

Macro Theme: "${theme}"

Universe of Tickers: ${tickerList}

For each company, provide:
- ticker: stock symbol (must be from the universe above)
- company: company name
- reasoning: 2-3 sentences explaining the second-order benefit
- signal: the specific mechanism of benefit (e.g., "input cost reduction", "regulatory tailwind", "supply chain consolidation")
- conviction: 1-10 scale

Return ONLY a valid JSON array with no markdown, no explanation. Example format:
[{"ticker":"TSM","company":"Taiwan Semiconductor Manufacturing","reasoning":"Benefits from AI infrastructure buildout...","signal":"Increased capacity demand","conviction":8}]`;

    const responseText = await callLLM(prompt);
    let beneficiaries;
    try {
      beneficiaries = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse beneficiaries response:', responseText);
      throw new Error('Claude response was not valid JSON');
    }

    return Array.isArray(beneficiaries) ? beneficiaries : [beneficiaries];
  } catch (error) {
    console.error('Error in getSecondOrderBeneficiaries:', error.message);
    throw error;
  }
}

// Analyze recent earnings call or 8-K filing
export async function analyzeEarningsCall(ticker) {
  try {
    if (!ANTHROPIC_API_KEY) {
      console.warn('ANTHROPIC_API_KEY not set. Returning mock earnings analysis.');
      return generateMockEarningsAnalysis(ticker);
    }

    // Try to fetch recent 8-K from SEC EDGAR
    // Note: In production, would need proper CIK lookup and EDGAR integration
    // For now, construct a search URL that could be used
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const today = new Date();
    const dateFormat = d => d.toISOString().split('T')[0];

    const edgarSearchUrl = `https://efts.sec.gov/LATEST/search-index?q="${ticker}"&dateRange=custom&startdt=${dateFormat(thirtyDaysAgo)}&enddt=${dateFormat(today)}&forms=8-K`;

    let filingContent = '';
    try {
      // Attempt to fetch from SEC (may fail due to rate limiting or access)
      const filingResponse = await fetch(edgarSearchUrl);
      if (filingResponse.ok) {
        const filingData = await filingResponse.text();
        filingContent = filingData.substring(0, 5000); // Limit content
      }
    } catch (fetchErr) {
      console.log(`Could not fetch SEC filing for ${ticker}: ${fetchErr.message}`);
    }

    const prompt = `You are a financial analyst. Analyze the recent earnings or SEC filing for ${ticker}.

${filingContent ? `Filing Content:\n${filingContent}` : `No recent SEC filing available for analysis. Provide a general earnings analysis template.`}

Provide a structured summary including:
- epsVsEstimate: actual EPS vs consensus estimate (or "N/A")
- revenueVsEstimate: actual revenue vs consensus (or "N/A")
- guidanceChange: change in forward guidance (or "Maintained")
- managementTone: assessment of management tone ("Bullish", "Cautious", "Neutral")
- keyQuotes: array of 3 most important quotes from call (or empty array if not available)
- thesisImpact: impact on investment thesis ("Strengthens", "Weakens", or "Neutral")
- summary: 2-3 sentence summary

Return ONLY a valid JSON object with no markdown, no explanation.`;

    const responseText = await callLLM(prompt);
    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse earnings analysis response:', responseText);
      throw new Error('Claude response was not valid JSON');
    }

    return analysis;
  } catch (error) {
    console.error('Error in analyzeEarningsCall:', error.message);
    throw error;
  }
}

// Helper: run analyst generation if no theses in last 23 hours
export async function runAnalystIfStale() {
  try {
    const oneDayAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
    const recentCount = await AIThesis.countDocuments({ generatedAt: { $gte: oneDayAgo } });

    if (recentCount === 0) {
      console.log('No theses generated in last 23h. Running analyst...');
      return await generateDailyTheses();
    }

    console.log(`Found ${recentCount} recent theses. Skipping generation.`);
    return [];
  } catch (error) {
    console.error('Error in runAnalystIfStale:', error.message);
    return [];
  }
}

// Mock data generators for testing when API key is missing
function generateMockTheses() {
  return [
    {
      ticker: 'NVDA',
      headline: 'AI infrastructure buildout drives sustained demand',
      thesis:
        'Nvidia is well-positioned to capture accelerating AI compute demand as enterprises deploy large language models. Data center revenue growth remains robust despite competitive pressures. Margin expansion opportunities exist as production scales.',
      whyNow: 'Q1 earnings beat signals sustained momentum. New product launches strengthen competitive moat.',
      conviction: 9,
      entry: 120.5,
      target: 165.0,
      stop: 105.0,
      timeframe: '6-12 months',
      catalysts: ['GTC conference announcements', 'Data center revenue acceleration', 'AI adoption acceleration'],
      riskFactors: ['Competitive pressure from AMD/Intel', 'Geopolitical export restrictions', 'Valuation premium compression'],
      dataPoints: ['70% YoY data center revenue growth', 'Gross margin expansion to 70%', 'Strong enterprise bookings'],
      sector: 'Semiconductors',
      status: 'pending',
    },
    {
      ticker: 'GOOGL',
      headline: 'AI integration in search drives monetization upside',
      thesis:
        'Google is monetizing AI through search integration and Workspace products. AI Overviews and generative search features could drive higher engagement and improved ad relevance. Expanding cloud margins benefit from AI infrastructure services.',
      whyNow: 'AI Overviews rollout accelerates. Gemini adoption among enterprises grows.',
      conviction: 7,
      entry: 185.25,
      target: 225.0,
      stop: 165.0,
      timeframe: '12+ months',
      catalysts: ['Search monetization improvement', 'Cloud revenue acceleration', 'Gemini adoption in enterprise'],
      riskFactors: ['Search disruption from AI chatbots', 'Regulatory scrutiny on AI', 'Market share loss in cloud'],
      dataPoints: ['AI Overviews in 10M+ searches', 'Cloud growth accelerating to 30%+', 'Workspace AI features launched'],
      sector: 'Technology',
      status: 'pending',
    },
  ];
}

function generateMockBeneficiaries(theme) {
  return [
    {
      ticker: 'TSM',
      company: 'Taiwan Semiconductor Manufacturing',
      reasoning:
        'TSM benefits from increased AI chip manufacturing as customers like Nvidia, AMD, and others scale production. Foundry capacity constraints create pricing power.',
      signal: 'Increased manufacturing demand from AI chip designers',
      conviction: 8,
    },
    {
      ticker: 'ASML',
      company: 'ASML Holding',
      reasoning: 'ASML provides extreme ultraviolet lithography equipment essential for advanced AI chip manufacturing. Supply constraints support higher pricing.',
      signal: 'Increased capex by foundries for advanced capacity',
      conviction: 8,
    },
  ];
}

function generateMockEarningsAnalysis(ticker) {
  return {
    ticker,
    epsVsEstimate: 'Beat by 12%',
    revenueVsEstimate: 'Beat by 5%',
    guidanceChange: 'Raised FY guidance by 8%',
    managementTone: 'Bullish',
    keyQuotes: [
      'AI demand remains robust and broad-based across all customer segments',
      'We expect supply chain constraints to ease in H2 2024',
      'Margin expansion driven by product mix shift to higher-margin offerings',
    ],
    thesisImpact: 'Strengthens',
    summary: `Strong earnings beat with guidance raise signals sustained momentum in core business. Management commentary confirms robust AI infrastructure demand and improving supply dynamics. FY guidance increase provides confidence in growth trajectory.`,
  };
}
