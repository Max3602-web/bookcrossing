const express = require('express');
const { requireAuth, requireAnyRole } = require('../middleware/auth');
const { getExchangesReport, getCatalogReport } = require('../repositories/reports');

const router = express.Router();

// GET /api/reports/exchanges?from=2026-10-01&to=2026-10-31
router.get('/exchanges', requireAuth, requireAnyRole('admin', 'moderator'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const report = await getExchangesReport({ from, to });
    return res.json(report);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/reports/catalog
router.get('/catalog', requireAuth, requireAnyRole('admin', 'moderator'), async (req, res) => {
  try {
    const report = await getCatalogReport();
    return res.json(report);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;