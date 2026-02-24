const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, admin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  // User/Public
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  markHelpful,
  reportReview,
  
  // Admin Single
  getAllReviews,
  getReviewById,
  approveReview,
  rejectReview,
  replyToReview,
  deleteReviewAdmin,
  
  // Admin Bulk
  bulkApproveReviews,
  bulkRejectReviews,
  bulkDeleteReviews,
  bulkReplyToReviews
} = require('../controllers/reviewController'); // ← Fix: capital C

// Validation rules
const reviewValidation = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('title').notEmpty().withMessage('Title is required').isLength({ max: 100 }),
  body('comment').notEmpty().withMessage('Comment is required').isLength({ max: 1000 }),
  body('images.*.url').optional().isURL().withMessage('Valid image URL required'),
  body('images.*.alt').optional().isString()
];

const replyValidation = [
  body('comment').notEmpty().withMessage('Reply comment is required')
];

const reportValidation = [
  body('reason').notEmpty().withMessage('Report reason is required')
];

const bulkOperationValidation = [
  body('reviewIds').isArray().withMessage('reviewIds must be an array').notEmpty(),
  body('reviewIds.*').isMongoId().withMessage('Invalid review ID format')
];

// ==================== PUBLIC/USER REVIEW ROUTES ====================
router.get('/products/:productId/reviews', getProductReviews);
router.post('/products/:productId/reviews', protect, reviewValidation, validate, createReview);
router.put('/reviews/:reviewId', protect, reviewValidation, validate, updateReview);
router.delete('/reviews/:reviewId', protect, deleteReview);
router.post('/reviews/:reviewId/helpful', protect, markHelpful);
router.post('/reviews/:reviewId/report', protect, reportValidation, validate, reportReview);

// ==================== ADMIN REVIEW ROUTES ====================
router.use('/admin/reviews', protect, admin); // Apply auth to all admin review routes

// ===== BULK ROUTES FIRST (must come BEFORE :reviewId) =====
router.post('/admin/reviews/bulk/approve', bulkOperationValidation, validate, bulkApproveReviews);
router.post('/admin/reviews/bulk/reject', bulkOperationValidation, validate, bulkRejectReviews);
router.post('/admin/reviews/bulk/delete', bulkOperationValidation, validate, bulkDeleteReviews);
router.post('/admin/reviews/bulk/reply', [
  ...bulkOperationValidation,
  body('comment').notEmpty().withMessage('Reply comment is required')
], validate, bulkReplyToReviews);

// ===== COLLECTION ROUTE =====
router.get('/admin/reviews', getAllReviews);

// ===== SINGLE REVIEW ROUTES (with :reviewId) - THESE COME LAST =====
router.get('/admin/reviews/:reviewId', getReviewById);
router.patch('/admin/reviews/:reviewId/approve', approveReview);
router.patch('/admin/reviews/:reviewId/reject', rejectReview);
router.post('/admin/reviews/:reviewId/reply', replyValidation, validate, replyToReview);
router.delete('/admin/reviews/:reviewId', deleteReviewAdmin);

module.exports = router;