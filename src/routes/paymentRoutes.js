// routes/paymentRoutes.js
const express = require('express');
const { 
  createPaymentIntent, 
  handleFailedPaymentClient,
  stripeWebhook
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// IMPORTANT: Webhook route must be raw body parser - this is correct
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Protected routes (these use express.json() automatically from server.js)
router.post('/create-intent', protect, createPaymentIntent);
router.post('/failed', protect, handleFailedPaymentClient);

module.exports = router;