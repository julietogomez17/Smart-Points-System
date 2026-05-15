const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET ALL PARTNERS
router.get('/', (req, res) => {
  const sql = `
    SELECT partner_id, organization_name
    FROM partners
    WHERE status = 'active'
    ORDER BY organization_name ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch partners',
        error: err.message
      });
    }

    res.json({
      success: true,
      partners: results
    });
  });
});

module.exports = router;