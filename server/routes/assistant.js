import express from 'express';
import Conversation from '../models/Conversation.js';
import Stock from '../models/Stock.js';
import Position from '../models/Position.js';
import Contact from '../models/Contact.js';
import News from '../models/News.js';

const router = express.Router();
async function llmChat(systemPrompt, messages, maxTokens = 1024) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// Build system prompt injected with live user data
async function buildContext() {
  try {
    const [stocks, positions, contacts, news] = await Promise.all([
      Stock.find().sort({ changePercent: -1 }).limit(20).lean(),
      Position.find().lean(),
      Contact.find().lean(),
      News.find().sort({ publishedAt: -1 }).limit(8).lean().catch(() => []),
    ]);

    let ctx = `You are a sharp, concise personal finance and investment assistant built into the user's Torii Market Hub. `;
    ctx += `You have real-time access to their portfolio, watchlist, network, and market data shown below. `;
    ctx += `Be direct and insightful. Reference their actual data when relevant. Don't pad your answers.\n\n`;

    ctx += `TODAY: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}\n\n`;

    if (stocks.length > 0) {
      const gainers = stocks.filter(s => s.changePercent > 0).slice(0, 5);
      const losers  = [...stocks].sort((a,b) => a.changePercent - b.changePercent).slice(0, 5);
      ctx += `WATCHLIST / MARKET:\n`;
      stocks.forEach(s => {
        const sign = s.changePercent >= 0 ? '+' : '';
        ctx += `  ${s.ticker}: $${s.price?.toFixed(2)} (${sign}${s.changePercent?.toFixed(2)}%)${s.name ? ` — ${s.name}` : ''}\n`;
      });
      ctx += '\n';
    }

    if (positions.length > 0) {
      ctx += `USER'S PORTFOLIO:\n`;
      let totalValue = 0, totalCost = 0;
      positions.forEach(p => {
        const stock = stocks.find(s => s.ticker === p.ticker);
        const price = stock?.price || p.costBasis;
        const value = p.shares * price;
        const cost  = p.shares * p.costBasis;
        const pnl   = value - cost;
        totalValue += value; totalCost += cost;
        ctx += `  ${p.ticker}: ${p.shares} sh @ $${p.costBasis} cost → $${value.toFixed(0)} value, P&L $${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}\n`;
      });
      const totalPnl = totalValue - totalCost;
      ctx += `  TOTAL: $${totalValue.toFixed(0)} value, $${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)} P&L\n\n`;
    }

    if (contacts.length > 0) {
      ctx += `USER'S NETWORK (${contacts.length} contacts):\n`;
      contacts.forEach(c => {
        const parts = [c.name];
        if (c.role)     parts.push(c.role);
        if (c.company)  parts.push(`@ ${c.company}`);
        if (c.school)   parts.push(`| ${c.school}`);
        if (c.location) parts.push(`(${c.location})`);
        ctx += `  ${parts.join(' ')}\n`;
      });
      ctx += '\n';
    }

    if (news.length > 0) {
      ctx += `RECENT NEWS HEADLINES:\n`;
      news.forEach(n => {
        ctx += `  • ${n.title}${n.source ? ` [${n.source}]` : ''}\n`;
      });
      ctx += '\n';
    }

    return ctx;
  } catch (err) {
    console.error('Context build error:', err.message);
    return `You are a personal finance and investment assistant. Today is ${new Date().toLocaleDateString()}.`;
  }
}

// GET conversation list
router.get('/conversations', async (req, res) => {
  try {
    const convos = await Conversation.find()
      .sort({ updatedAt: -1 })
      .limit(30)
      .select('title updatedAt createdAt messages');
    res.json(convos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single conversation
router.get('/conversations/:id', async (req, res) => {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: 'Not found' });
    res.json(convo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST chat message (creates or continues conversation)
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });

    let convo = conversationId
      ? await Conversation.findById(conversationId)
      : null;

    if (!convo) {
      convo = new Conversation({
        title: message.slice(0, 60) + (message.length > 60 ? '…' : ''),
        messages: [],
      });
    }

    // Add user message
    convo.messages.push({ role: 'user', content: message });

    // Build system context (fresh every call)
    const systemPrompt = await buildContext();

    // Last 20 messages for API
    const apiMessages = convo.messages.slice(-20).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const assistantText = await llmChat(systemPrompt, apiMessages, 1024);
    convo.messages.push({ role: 'assistant', content: assistantText });

    await convo.save();

    res.json({
      conversationId: convo._id,
      message:        assistantText,
      title:          convo.title,
    });
  } catch (err) {
    console.error('Assistant chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE conversation
router.delete('/conversations/:id', async (req, res) => {
  try {
    await Conversation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
