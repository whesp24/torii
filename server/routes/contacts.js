import express from 'express';
import Contact from '../models/Contact.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: 1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, role, company, school, location, linkedIn, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const contact = await Contact.create({ name, role, company, school, location, linkedIn, notes });
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/touch — mark contact as contacted today (CRM)
router.post('/:id/touch', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { lastContactedAt: new Date() },
      { new: true }
    );
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json({ message: 'Deleted', contact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;