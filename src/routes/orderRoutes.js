  
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getMyOrders,
  getOrder,
  createOrder,
  cancelOrder
} = require('../controllers/orderController');

// Validation rules
const orderValidation = [
  body('items').optional().isArray().withMessage('Items must be an array'),
  body('items.*.product').optional().isMongoId().withMessage('Invalid product ID'),
  body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
  body('shippingAddress').optional().isObject().withMessage('Shipping address must be an object'),
  body('shippingAddress.firstName').optional().notEmpty().withMessage('First name is required in shipping address'),
  body('shippingAddress.lastName').optional().notEmpty().withMessage('Last name is required in shipping address'),
  body('shippingAddress.email').optional().isEmail().withMessage('Valid email is required in shipping address'),
  body('shippingAddress.phone').optional().notEmpty().withMessage('Phone is required in shipping address')
];

// Routes
router.get('/my-orders', protect, getMyOrders);
router.get('/:id', protect, getOrder);
router.post('/', protect, orderValidation, validate, createOrder);
router.put('/:id/cancel', protect, cancelOrder);

module.exports = router;