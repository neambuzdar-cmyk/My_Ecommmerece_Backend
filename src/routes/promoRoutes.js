// src/routes/promoRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, admin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  // Public
  validatePromoCode,
  getValidPromoCodes,
  
  // Protected
  applyPromoCode,
  
  // Admin
  createPromoCode,
  getPromoCodes,
  getPromoCodeStats,
  exportPromoCodes,
  getPromoCode,
  updatePromoCode,
  togglePromoCode,
  deletePromoCode,
  bulkDeletePromoCodes,
  bulkUpdatePromoStatus
} = require('../controllers/promoController');

// Validation rules
const promoValidation = [
  body('code').notEmpty().withMessage('Promo code is required')
    .isLength({ max: 50 }).withMessage('Code cannot exceed 50 characters'),
  body('discountType').isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
  body('discountValue').isFloat({ min: 0 }).withMessage('Discount value must be positive'),
  body('minOrderAmount').optional().isFloat({ min: 0 }),
  body('maxDiscount').optional().isFloat({ min: 0 }),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('endDate').isISO8601().withMessage('Valid end date required')
    .custom((value, { req }) => new Date(value) > new Date(req.body.startDate))
    .withMessage('End date must be after start date'),
  body('usageLimit').optional().isInt({ min: 1 }),
  body('perUserLimit').optional().isInt({ min: 1 })
];

// ==================== PUBLIC ROUTES ====================
router.post('/validate', validatePromoCode);
router.get('/valid', getValidPromoCodes);

// ==================== PROTECTED ROUTES ====================
router.use(protect);
router.post('/apply', applyPromoCode);

// ==================== ADMIN ROUTES ====================
router.use(admin);

// IMPORTANT: Order matters - specific routes first, then dynamic routes
router.get('/stats', getPromoCodeStats);
router.get('/export', exportPromoCodes);
router.post('/bulk-delete', bulkDeletePromoCodes);
router.post('/bulk-status', bulkUpdatePromoStatus);

// CRUD routes
router.post('/', promoValidation, validate, createPromoCode);
router.get('/', getPromoCodes);
router.get('/:id', getPromoCode);
router.put('/:id', promoValidation, validate, updatePromoCode);
router.patch('/:id/toggle', togglePromoCode);
router.delete('/:id', deletePromoCode);

router.use((req, res, next) => {
  console.log('Promo route - User:', req.user);
  console.log('Promo route - Headers:', req.headers.authorization);
  next();
});

module.exports = router;