import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import Meeting from '../models/Meeting.js';
import Contact from '../models/Contact.js';
import Stock from '../models/Stock.js';

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET all meetings
router.get('/', async (req, res) => {
  try {
    const meetings = await Meeting.find().sort({ date: 1 });
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create meeting
router.post('/', async (req, res) => {
  try {
    const { contactId, contactName, company, date, type, agenda } = req.body;
    if (!contactName?.trim() || !date) return res.status(400).json({ error: 'contactName and date required' });
    const meeting = await Meeting.create({ contactId, contactName, company, date, type, agenda });
    res.status(201).json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update meeting (status, post-call notes, etc.)
router.put('/:id', async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE meeting
router.delete('/:id', async (req, res) => {
  try {
    await Meeting.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate AI brief for a meeting
router.post('/:id/brief', async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    // Fetch linked contact if available
    let contact = null;
    if (meeting.contactId) {
      contact = await Contact.findById(meeting.contactId).catch(() => null);
    }

    // Fetch company stock data if available
    let stockInfo = '';
    if (meeting.company) {
      const stock = await Stock.findOne({
        $or: [
          { name: { $regex: meeting.company, $options: 'i' } },
          { ticker: meeting.company.toUpperCase() },
        ]
      }).catch(() => null);
      if (stock) {
        const sign = stock.changePercent >= 0 ? '+' : '';
        stockInfo = `\nCompany stock: ${stock.ticker} at $${stock.price?.toFixed(2)} (${sign}${stock.changePercent?.toFixed(2)}% today)`;
      }
    }

    const dateStr = new Date(meeting.date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const contactDetails = contact
      ? `\nContact: ${contact.role || ''} ${contact.company ? `at ${contact.company}` : ''}, ${contact.school ? `${contact.school} alum,` : ''} ${contact.location || ''}. Notes: ${contact.notes || 'none'}`
      : '';

    const prompt = `Generate a sharp, actionable pre-meeting brief for a ${meeting.type} with ${meeting.contactName}${meeting.company ? ` at ${meeting.company}` : ''} on ${dateStr}.
${contactDetails}${stockInfo}
${meeting.agenda ? `\nAgenda/context: ${meeting.agenda}` : ''}

Structure your response with these sections:
**Background** (2–3 sentences on the person/company)
**Key Talking Points** (3–4 bullets to prepare)
**Questions to Ask** (2–3 sharp questions)
**Recent Context** (any news, stock moves, or market angles to reference)

Be punchy. No fluff. This should take 60 seconds to read.`;

    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 700,
      messages:   [{ role: 'user', content: prompt }],
    });

    const brief = response.content[0].text;
    await Meeting.findByIdAndUpdate(meeting._id, { brief });

    res.json({ brief });
  } catch (err) {
    console.error('Brief generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
