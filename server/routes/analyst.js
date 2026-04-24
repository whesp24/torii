import express from 'express';
import AIThesis from '../models/AIThesis.js';
import {
  generateDailyTheses,
  getSecondOrderBeneficiaries,
  analyzeEarningsCall,
} from '../services/aiAnalystService.js';

const router = express.Router();

// GET /analyst - Return last 20 AIThesis docs sorted by generatedAt desc
// Returns array directly — frontend uses Array.isArray() check
router.get('/', async (req, res) => {
  try {
    const theses = await AIThesis.find()
      .sort({ generatedAt: -1 })
      .limit(20)
      .lean();
    res.json(theses);
  } catch (error) {
    console.error('Error fetching theses:', error.message);
    res.status(500).json([]);
  }
});

// POST /analyst/generate - Call generateDailyTheses() and return results
// Returns array directly to match frontend Array.isArray() check
router.post('/generate', async (req, res) => {
  try {
    const theses = await generateDailyTheses();
    res.json(Array.isArray(theses) ? theses : []);
  } catch (error) {
    console.error('Error generating theses:', error.message);
    res.status(500).json([]);
  }
});

// PATCH /analyst/:id/approve - Set status='approved', reviewedAt=now
router.patch('/:id/approve', async (req, res) => {
  try {
    const thesis = await AIThesis.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        reviewedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!thesis) {
      return res.status(404).json({
        success: false,
        error: 'Thesis not found',
      });
    }

    res.json({
      success: true,
      message: 'Thesis approved',
      data: thesis,
    });
  } catch (error) {
    console.error('Error approving thesis:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PATCH /analyst/:id/dismiss - Set status='dismissed', reviewedAt=now
router.patch('/:id/dismiss', async (req, res) => {
  try {
    const thesis = await AIThesis.findByIdAndUpdate(
      req.params.id,
      {
        status: 'dismissed',
        reviewedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!thesis) {
      return res.status(404).json({
        success: false,
        error: 'Thesis not found',
      });
    }

    res.json({
      success: true,
      message: 'Thesis dismissed',
      data: thesis,
    });
  } catch (error) {
    console.error('Error dismissing thesis:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE /analyst/:id - Delete thesis
router.delete('/:id', async (req, res) => {
  try {
    const thesis = await AIThesis.findByIdAndDelete(req.params.id);

    if (!thesis) {
      return res.status(404).json({
        success: false,
        error: 'Thesis not found',
      });
    }

    res.json({
      success: true,
      message: 'Thesis deleted',
      data: thesis,
    });
  } catch (error) {
    console.error('Error deleting thesis:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /analyst/theme - Call getSecondOrderBeneficiaries(req.body.theme)
router.post('/theme', async (req, res) => {
  try {
    const { theme } = req.body;

    if (!theme || typeof theme !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'theme parameter is required and must be a string',
      });
    }

    const beneficiaries = await getSecondOrderBeneficiaries(theme);

    res.json({
      success: true,
      theme,
      data: beneficiaries,
      count: beneficiaries.length,
    });
  } catch (error) {
    console.error('Error analyzing theme:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /analyst/earnings - Call analyzeEarningsCall(req.body.ticker)
router.post('/earnings', async (req, res) => {
  try {
    const { ticker } = req.body;

    if (!ticker || typeof ticker !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ticker parameter is required and must be a string',
      });
    }

    const analysis = await analyzeEarningsCall(ticker.toUpperCase());

    res.json({
      success: true,
      ticker: ticker.toUpperCase(),
      data: analysis,
    });
  } catch (error) {
    console.error('Error analyzing earnings:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /analyst/stats - Return statistics about theses (flat object, no wrapper)
router.get('/stats', async (req, res) => {
  try {
    const [total, pending, approved, dismissed, todayGenerated] = await Promise.all([
      AIThesis.countDocuments(),
      AIThesis.countDocuments({ status: 'pending' }),
      AIThesis.countDocuments({ status: 'approved' }),
      AIThesis.countDocuments({ status: 'dismissed' }),
      AIThesis.countDocuments({ generatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ]);
    res.json({ total, pending, approved, dismissed, todayGenerated });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({ total: 0, pending: 0, approved: 0, dismissed: 0, todayGenerated: 0 });
  }
});

export default router;
