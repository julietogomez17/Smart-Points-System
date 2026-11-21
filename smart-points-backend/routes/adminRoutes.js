
const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');

const {
  verifyToken,
  requireAccountRequestAccess
} = require('../middleware/authMiddleware');

// =====================================================
// AUTHENTICATION AND ACCOUNT REQUEST PERMISSIONS
// =====================================================

// Require a valid login token.
router.use(verifyToken);

// Allow only the designated City Super Admin
// or authorized City/Barangay LGU verifiers.
router.use(requireAccountRequestAccess);


// =====================================================
// GET CITIZEN AND ESTABLISHMENT ACCOUNT REQUESTS
// =====================================================

router.get(
  '/account-requests',
  adminController.getAccountRequests
);


// =====================================================
// CITY SUPER ADMIN - LGU REGISTRATION REQUESTS
// IMPORTANT: These routes must appear BEFORE the
// general Citizen/Partner dynamic routes.
// =====================================================

// Get all City and Barangay LGU applications.
router.get(
  '/account-requests/lgu/list',
  adminController.getLGUAccountRequests
);

// Get one LGU registration's details.
router.get(
  '/account-requests/lgu/:id',
  adminController.getLGUAccountDetails
);

// View LGU Letter of Intent or representative ID.
router.get(
  '/account-requests/lgu/:id/documents/:documentType',
  adminController.getLGUAccountDocument
);

// Approve or reject an LGU registration.
router.patch(
  '/account-requests/lgu/:id/:decision',
  adminController.reviewLGUAccountRequest
);


// =====================================================
// EXISTING CITIZEN AND ESTABLISHMENT REQUEST DETAILS
// =====================================================

router.get(
  '/account-requests/:type/:id',
  adminController.getAccountRequestDetails
);


// =====================================================
// EXISTING CITIZEN AND ESTABLISHMENT DOCUMENTS
// =====================================================

router.get(
  '/account-requests/:type/:id/documents/:documentType',
  adminController.getAccountDocument
);


// =====================================================
// EXISTING CITIZEN AND ESTABLISHMENT APPROVAL
// =====================================================

router.patch(
  '/account-requests/:type/:id/:decision',
  adminController.reviewAccountRequest
);


module.exports = router;
