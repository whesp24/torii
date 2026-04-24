import express from 'express';
import LP from '../models/LP.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try { res.json(await LP.find().sort({ name: 1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try { res.status(201).json(await LP.create(req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const lp = await LP.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lp) return res.status(404).json({ error: 'Not found' });
    res.json(lp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await LP.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Capital calls & distributions
router.post('/:id/capitalcall', async (req, res) => {
  try {
    const lp = await LP.findById(req.params.id);
    if (!lp) return res.status(404).json({ error: 'Not found' });
    lp.capitalCalls.push(req.body);
    lp.called = (lp.called || 0) + (req.body.amount || 0);
    await lp.save();
    res.json(lp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/distribution', async (req, res) => {
  try {
    const lp = await LP.findById(req.params.id);
    if (!lp) return res.status(404).json({ error: 'Not found' });
    lp.distributions.push(req.body);
    lp.distributed = (lp.distributed || 0) + (req.body.amount || 0);
    await lp.save();
    res.json(lp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
