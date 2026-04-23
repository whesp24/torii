import express from 'express';
import Deal from '../models/Deal.js';
import Stock from '../models/Stock.js';
import News from '../models/News.js';

const router = express.Router();

async function llmChat(prompt, maxTokens = 900) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// POST /api/memos/generate — generate investment memo for a deal
router.post('/generate', async (req, res) => {
  try {
    const { dealId } = req.body;
    if (!dealId) return res.status(400).json({ error: 'dealId required' });

    const deal = await Deal.findById(dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    // Fetch stock data if ticker exists
    let stockInfo = '';
    if (deal.ticker) {
      const stock = await Stock.findOne({ $or: [{ symbol: deal.ticker }, { ticker: deal.ticker }] }).lean().catch(() => null);
      if (stock) {
        const sign = stock.changePercent >= 0 ? '+' : '';
        stockInfo = `\nMarket data: ${deal.ticker} at $${stock.price?.toFixed(2)} (${sign}${stock.changePercent?.toFixed(2)}% today)`;
        if (deal.targetPrice) {
          const upside = ((deal.targetPrice - stock.price) / stock.price) * 100;
          stockInfo += ` → Target $${deal.targetPrice} (${upside >= 0 ? '+' : ''}${upside.toFixed(1)}% upside)`;
        }
      }
    }

    // Fetch relevant news
    const newsItems = await News.find({
      $or: [
        { title: { $regex: deal.company, $options: 'i' } },
        deal.ticker ? { title: { $regex: deal.ticker, $options: 'i' } } : {},
      ]
    }).sort({ publishedAt: -1 }).limit(3).lean().catch(() => []);

    const catalysts = Array.isArray(deal.catalysts) ? deal.catalysts.join('\n  - ') : (deal.catalysts || '');
    const risks = Array.isArray(deal.risks) ? deal.risks.join('\n  - ') : (deal.risks || '');

    const prompt = `Write a concise 1-page investment memo for a private equity / investment professional.

Company: ${deal.company}${deal.ticker ? ` (${deal.ticker})` : ''}
Stage: ${deal.stage} | Priority: ${deal.priority}${stockInfo}

Thesis: ${deal.thesis || 'Not yet articulated'}

Catalysts:
  - ${catalysts || 'None specified'}

Risks:
  - ${risks || 'None specified'}

${deal.notes ? `Additional notes: ${deal.notes}` : ''}
${newsItems.length > 0 ? `\nRecent news:\n${newsItems.map(n => '  • ' + n.title).join('\n')}` : ''}

Write a structured investment memo with these exact sections:

**INVESTMENT MEMO — ${deal.company.toUpperCase()}**
*${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · ${deal.stage.charAt(0).toUpperCase() + deal.stage.slice(1)} Stage*

**Thesis**
[2-3 sentences articulating the core investment hypothesis. Be specific about the edge.]

**Opportunity**
[Market context, why this company, why now. 2-3 sentences.]

**Catalysts** (near-term, 6-18 months)
[Bullet the key catalysts that will drive value creation]

**Risks & Mitigants**
[Bullet key risks with a brief mitigant for each]

**Valuation**
[Commentary on valuation, target price if given, upside/downside]

**Recommended Action**
[One clear sentence: what should happen next with this position]

Be direct and analytical. Avoid generic statements. Reference actual data from the memo inputs.`;

    const memo = await llmChat(prompt, 900);

    // Save memo back to deal
    await Deal.findByIdAndUpdate(dealId, { memo, memoGeneratedAt: new Date() });

    res.json({ memo, generatedAt: new Date() });
  } catch (err) {
    console.error('Memo generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
