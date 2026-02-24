  
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist
} = require('../controllers/wishlistController');

// Validation rules
const addToWishlistValidation = [
  body('productId').isMongoId().withMessage('Invalid product ID')
];

// Routes
router.get('/', protect, getWishlist);
router.post('/', protect, addToWishlistValidation, validate, addToWishlist);
router.delete('/:productId', protect, removeFromWishlist);
router.get('/check/:productId', protect, checkWishlist);

module.exports = router;