  
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('../controllers/cartController');

// Validation rules
const addToCartValidation = [
  body('productId').isMongoId().withMessage('Invalid product ID'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1')
];

const updateCartValidation = [
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be 0 or greater')
];

// Routes
router.get('/', protect, getCart);
router.post('/items', protect, addToCartValidation, validate, addToCart);
router.put('/items/:id', protect, updateCartValidation, validate, updateCartItem);
router.delete('/items/:id', protect, removeFromCart);
router.delete('/clear', protect, clearCart);

module.exports = router;