import Briefing from '../models/Briefing.js';
import Stock from '../models/Stock.js';
import Position from '../models/Position.js';
import News from '../models/News.js';
import Deal from '../models/Deal.js';
import Meeting from '../models/Meeting.js';
import KPI from '../models/KPI.js';

async function llmChat(prompt, maxTokens = 700) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function generateAndSaveBriefing({ force = false } = {}) {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (!force) {
      const existing = await Briefing.findOne({ date: { $gte: today, $lt: new Date(today.getTime() + 86400000) } });
      if (existing?.summary) return existing;
    }

    const now = new Date();
    const weekFromNow = new Date(Date.now() + 7 * 86400000);

    const [stocks, positions, news, deals, meetings, kpis] = await Promise.all([
      Stock.find().sort({ changePercent: -1 }).limit(20).lean(),
      Position.find().lean(),
      News.find().sort({ publishedAt: -1 }).limit(8).lean().catch(() => []),
      Deal.find({ stage: { $in: ['thesis', 'conviction', 'position'] } }).lean(),
      Meeting.find({ date: { $gte: now, $lte: weekFromNow } }).sort({ date: 1 }).limit(5).lean(),
      KPI.find().lean(),
    ]);

    // Portfolio summary
    let portfolioLines = [];
    let totalValue = 0, totalDayPnl = 0;
    if (positions.length > 0) {
      for (const p of positions) {
        const stock = stocks.find(s => s.symbol === p.ticker) || stocks.find(s => s.ticker === p.ticker);
        const price = stock?.price || p.costBasis;
        const value = p.shares * price;
        const dayPnl = stock ? (stock.change || 0) * p.shares : 0;
        totalValue += value;
        totalDayPnl += dayPnl;
        portfolioLines.push(`  ${p.ticker}: $${value.toFixed(0)} | ${stock?.changePercent >= 0 ? '+' : ''}${(stock?.changePercent || 0).toFixed(2)}% today (${dayPnl >= 0 ? '+' : ''}$${dayPnl.toFixed(0)})`);
      }
    }

    const get = (sym) => kpis.find(k => k.symbol === sym);
    const fmt = (k, dec = 2) => k ? `${k.price.toFixed(dec)} (${k.changePercent >= 0 ? '+' : ''}${k.changePercent.toFixed(2)}%)` : 'N/A';

    const marketSummary = [
      `S&P 500: ${fmt(get('^GSPC'), 0)}`,
      `Nasdaq: ${fmt(get('^IXIC'), 0)}`,
      `Nikkei: ${fmt(get('^N225'), 0)}`,
      `VIX: ${get('^VIX') ? get('^VIX').price.toFixed(1) : 'N/A'}`,
      `USD/JPY: ${fmt(get('USDJPY=X'))}`,
      `Gold: ${fmt(get('GC=F'), 0)}`,
      `10Y: ${get('^TNX') ? get('^TNX').price.toFixed(2) + '%' : 'N/A'}`,
    ].join(' · ');

    const todayMeetings = meetings.filter(m => {
      const d = new Date(m.date);
      return d >= now && d < new Date(now.getTime() + 86400000);
    });

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const prompt = `Generate a sharp morning briefing for a private equity / investment professional. Today is ${dateStr}.

MARKETS: ${marketSummary}

${portfolioLines.length > 0 ? `PORTFOLIO ($${totalValue.toFixed(0)} total, day P&L: ${totalDayPnl >= 0 ? '+' : ''}$${totalDayPnl.toFixed(0)}):\n${portfolioLines.join('\n')}` : 'No portfolio positions.'}

${deals.length > 0 ? `ACTIVE DEALS:\n${deals.map(d => `  ${d.company} [${d.stage}]${d.thesis ? ': ' + d.thesis.slice(0, 100) : ''}`).join('\n')}` : ''}

${todayMeetings.length > 0 ? `TODAY'S MEETINGS:\n${todayMeetings.map(m => `  ${m.contactName}${m.company ? ' @ ' + m.company : ''} at ${new Date(m.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`).join('\n')}` : meetings.length > 0 ? `NEXT MEETING: ${meetings[0].contactName}${meetings[0].company ? ' @ ' + meetings[0].company : ''} in ${Math.ceil((new Date(meetings[0].date) - now) / 86400000)} days` : 'No upcoming meetings.'}

${news.length > 0 ? `TOP NEWS:\n${news.slice(0, 5).map(n => '  • ' + n.title).join('\n')}` : ''}

Write a morning briefing. Keep it under 250 words. Use this exact structure with markdown bold headers:

**Good morning.** [1 sentence overall market tone.]

**Portfolio** — [Notable moves, total P&L context if meaningful]

**Today** — [Meetings today or what to focus on if no meetings]

**Deal Radar** — [Anything from the active deals worth watching]

**Market Watch** — [3 bullets on what to monitor today]

**Edge** — [1 contrarian or forward-looking insight based on the data]

Be direct. Reference actual numbers and names from the data above. No filler.`;

    const summary = await llmChat(prompt, 600);
    const marketSentiment = (get('^GSPC')?.changePercent || 0) > 0.5 ? 'bullish' : (get('^GSPC')?.changePercent || 0) < -0.5 ? 'bearish' : 'neutral';

    const briefing = await Briefing.findOneAndUpdate(
      { date: { $gte: today, $lt: new Date(today.getTime() + 86400000) } },
      {
        date: today,
        marketSentiment,
        summary,
        topMovers: stocks.filter(s => Math.abs(s.changePercent || 0) > 1).slice(0, 5).map(s => ({
          symbol: s.symbol || s.ticker, change: s.changePercent, reason: `$${s.price?.toFixed(2)}`
        })),
        keyNews: news.slice(0, 3).map(n => ({ title: n.title, summary: n.description || '', impact: 'neutral' })),
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log('✓ AI briefing generated');
    return briefing;
  } catch (err) {
    console.error('Briefing generation error:', err.message);
    throw err;
  }
}
