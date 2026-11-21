
const express = require("express");
const router = express.Router();

const {
  verifyToken,
  requireSuperAdmin
} = require("../middleware/authMiddleware");

const {
  getAuditLogs
} = require("../controllers/auditController");

router.get(
  "/",
  verifyToken,
  requireSuperAdmin,
  getAuditLogs
);

module.exports = router;
