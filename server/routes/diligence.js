import express from 'express';
import Diligence from '../models/Diligence.js';

const router = express.Router();
const GROQ_KEY = process.env.GROQ_API_KEY || '';

const DEFAULT_SECTIONS = [
  { title: 'Management & Team', items: [
    { label: 'Management team backgrounds verified',     priority: 'critical' },
    { label: 'Reference checks completed',              priority: 'critical' },
    { label: 'Compensation & equity alignment reviewed', priority: 'high' },
    { label: 'Key person risk identified',              priority: 'high' },
    { label: 'Board composition & independence reviewed',priority: 'medium' },
  ]},
  { title: 'Financial', items: [
    { label: 'Audited financials reviewed (3 years)',    priority: 'critical' },
    { label: 'Revenue quality & recognition assessed',  priority: 'critical' },
    { label: 'Working capital & liquidity modeled',     priority: 'critical' },
    { label: 'Customer concentration risk analyzed',    priority: 'high' },
    { label: 'Unit economics validated',                priority: 'high' },
    { label: 'Cap table & dilution fully modeled',      priority: 'high' },
    { label: 'Debt & off-balance-sheet items reviewed', priority: 'high' },
    { label: 'Cash flow projections stress-tested',     priority: 'medium' },
  ]},
  { title: 'Legal & Compliance', items: [
    { label: 'Corporate structure verified',            priority: 'critical' },
    { label: 'IP ownership & freedom to operate confirmed', priority: 'critical' },
    { label: 'Regulatory compliance checked',           priority: 'critical' },
    { label: 'Material contracts reviewed',             priority: 'high' },
    { label: 'Litigation history checked',              priority: 'high' },
    { label: 'Employment agreements reviewed',          priority: 'medium' },
  ]},
  { title: 'Market & Competitive', items: [
    { label: 'TAM/SAM/SOM independently validated',    priority: 'critical' },
    { label: 'Competitive landscape fully mapped',      priority: 'high' },
    { label: 'Customer interviews completed (≥10)',     priority: 'high' },
    { label: 'Pricing power & margin durability assessed', priority: 'high' },
    { label: 'Regulatory/policy risks analyzed',        priority: 'medium' },
  ]},
  { title: 'Operations & Technology', items: [
    { label: 'Core technology assessed',                priority: 'high' },
    { label: 'Scalability of operations reviewed',      priority: 'high' },
    { label: 'Cybersecurity posture assessed',          priority: 'medium' },
    { label: 'Supply chain & key vendor risks identified', priority: 'medium' },
    { label: 'Data room completeness verified',         priority: 'medium' },
  ]},
].map(section => ({
  title: section.title,
  items: section.items.map((item, i) => ({
    id:      `${section.title.replace(/\s+/g,'_').toLowerCase()}_${i}`,
    label:   item.label,
    priority:item.priority,
    checked: false,
    notes:   '',
    flagged: false,
  })),
}));

router.get('/', async (req, res) => {
  try { res.json(await Diligence.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const d = await Diligence.findById(req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json(d);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { dealName, dealId, ticker, lead, targetClose, notes } = req.body;
    res.status(201).json(await Diligence.create({ dealName, dealId, ticker, lead, targetClose, notes, sections: DEFAULT_SECTIONS }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const d = await Diligence.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json(d);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /:id/item — toggle a checklist item
router.patch('/:id/item', async (req, res) => {
  try {
    const { sectionTitle, itemId, checked, notes, flagged } = req.body;
    const doc = await Diligence.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const section = doc.sections.find(s => s.title === sectionTitle);
    const item    = section?.items.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (checked !== undefined) item.checked = checked;
    if (notes   !== undefined) item.notes   = notes;
    if (flagged !== undefined) item.flagged = flagged;
    const all  = doc.sections.flatMap(s => s.items);
    doc.score  = Math.round(all.filter(i => i.checked).length / all.length * 100);
    doc.markModified('sections');
    await doc.save();
    res.json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /:id/ai-summary
router.post('/:id/ai-summary', async (req, res) => {
  try {
    const doc = await Diligence.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!GROQ_KEY) return res.json({ summary: 'GROQ_API_KEY not set' });
    const all     = doc.sections.flatMap(s => s.items);
    const done    = all.filter(i => i.checked);
    const flagged = all.filter(i => i.flagged);
    const pending = all.filter(i => !i.checked);
    const prompt = `You are a senior PE due diligence analyst. Summarize DD status for ${doc.dealName} (${doc.ticker || 'private'}).

COMPLETED (${done.length}/${all.length}): ${done.map(i => `✓ ${i.label}${i.notes?` (${i.notes})`:''}`).join('; ') || 'None'}
FLAGGED (${flagged.length}): ${flagged.map(i => `⚑ ${i.label}${i.notes?` (${i.notes})`:''}`).join('; ') || 'None'}
PENDING (${pending.length}): ${pending.slice(0,8).map(i => i.label).join('; ')}

Write 3-4 sentences: overall DD status, key risks/flags, what remains, and end with one of: "Ready for IC" / "Needs more work" / "Red flag — pause".`;
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 250, temperature: 0.3,
        messages: [{ role: 'user', content: prompt }] }),
    });
    const gd = await r.json();
    const summary = gd.choices?.[0]?.message?.content || '';
    await Diligence.findByIdAndUpdate(req.params.id, { aiSummary: summary });
    res.json({ summary });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await Diligence.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
