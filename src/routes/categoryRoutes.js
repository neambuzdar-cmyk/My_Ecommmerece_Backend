// src/routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

// Import category controller
const {
  getCategoryStats,
  getCategoryByName,
  getCategoryList,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  bulkDeleteCategories,
  bulkUpdateCategoryStatus,
  mergeCategories
} = require('../controllers/categoryController');

// Validation rules
const categoryValidation = [
  body('name').notEmpty().withMessage('Category name is required'),
  body('name').isLength({ max: 100 }).withMessage('Category name cannot exceed 100 characters')
];

// All routes require admin authentication
router.use(protect, admin);

// ==================== STATS & LISTING ====================
router.get('/stats', getCategoryStats);
router.get('/list', getCategoryList);
router.get('/:name', getCategoryByName);

// ==================== CRUD OPERATIONS ====================
router.post('/', categoryValidation, validate, createCategory);
router.put('/:name', categoryValidation, validate, updateCategory);
router.delete('/:name', deleteCategory);
router.patch('/:name/toggle', toggleCategoryStatus);

// ==================== BULK OPERATIONS ====================
router.post('/bulk/delete', bulkDeleteCategories);
router.post('/bulk/status', bulkUpdateCategoryStatus);
router.post('/merge', mergeCategories);

module.exports = router;