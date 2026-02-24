const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, admin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  // Public APIs
  getProducts,
  getProduct,
  getFeaturedProducts,
  getProductsByCategory,
  searchProducts,
  
  // Admin Single Operations
  createProduct,
  getAllProductsAdmin,
  getProductByIdAdmin,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  toggleProductActive,
  toggleProductFeatured,
  updateProductStock,
  
  // Admin Bulk Operations
  bulkDeleteProducts,
  bulkUpdateStatus,
  bulkUpdateFeatured,
  bulkDuplicateProducts,
  bulkUpdateProducts,
  bulkAddToCategory
} = require('../controllers/productController');

// Validation rules
const productValidation = [
  body('name').notEmpty().withMessage('Product name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('price').isNumeric().withMessage('Price must be a number').custom(value => value > 0).withMessage('Price must be greater than 0'),
  body('category').notEmpty().withMessage('Category is required'),
  body('sku').notEmpty().withMessage('SKU is required'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a positive number'),
  body('images.*.url').optional().isURL().withMessage('Image URL must be valid'),
  body('comparePrice').optional().isNumeric().withMessage('Compare price must be a number')
];

const bulkOperationValidation = [
  body('productIds').isArray().withMessage('productIds must be an array').notEmpty().withMessage('productIds cannot be empty'),
  body('productIds.*').isMongoId().withMessage('Invalid product ID format')
];

// ==================== PUBLIC ROUTES (No Auth Required) ====================
// ORDER IS IMPORTANT! Put specific routes FIRST, parameterized routes LAST

// 1. Search route (most specific)
router.get('/search', searchProducts);

// 2. Featured route
router.get('/featured', getFeaturedProducts);

// 3. Category route
router.get('/category/:cat', getProductsByCategory);

// 4. Main products list with filters
router.get('/', getProducts);

// 5. Single product by ID (must be LAST)
router.get('/:id', getProduct);



module.exports = router;