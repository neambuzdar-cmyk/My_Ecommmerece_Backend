// backend/src/routes/promoCodeRoutes.js
import express from 'express';
import {
  validatePromoCode,
  applyPromoCode,
  getValidPromoCodes,
  createPromoCode,
  getPromoCodes,
  getPromoCode,
  updatePromoCode,
  deletePromoCode,
  togglePromoCode,
  getPromoCodeStats,
  bulkDeletePromoCodes,
  bulkUpdatePromoStatus,
  exportPromoCodes
} from '../controllers/promoCodeController.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

// ==================== PUBLIC ROUTES (NO AUTH REQUIRED) ====================
router.post('/validate', validatePromoCode);
router.get('/valid', getValidPromoCodes);

// ==================== PROTECTED ROUTES (AUTH REQUIRED) ====================
router.use(verifyToken);
router.post('/apply', applyPromoCode);

// ==================== ADMIN ROUTES ====================
router.use(verifyAdmin);
router.post('/', createPromoCode);
router.get('/', getPromoCodes);
router.get('/stats', getPromoCodeStats);
router.get('/export', exportPromoCodes);
router.get('/:id', getPromoCode);
router.put('/:id', updatePromoCode);
router.patch('/:id/toggle', togglePromoCode);
router.delete('/:id', deletePromoCode);
router.post('/bulk-delete', bulkDeletePromoCodes);
router.post('/bulk-status', bulkUpdatePromoStatus);

export default router;