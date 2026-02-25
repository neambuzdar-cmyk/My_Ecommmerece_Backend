// src/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const adminRoutes = require('./routes/adminRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const promoRoutes = require('./routes/promoRoutes');
   // This imports the router
require('dotenv').config();

// Import routes - use EXACT file names from your directory
let authRoutes, userRoutes, productRoutes, orderRoutes, cartRoutes, wishlistRoutes, paymentRoutes;

try {
  authRoutes = require('./routes/authRoutes'); 
  console.log('✓ Auth routes loaded');
} catch (error) {
  console.error('✗ Failed to load auth routes:', error.message);
  authRoutes = express.Router();
}

try {
  userRoutes = require('./routes/userRoutes'); 
  console.log('✓ User routes loaded');
} catch (error) {
  console.error('✗ Failed to load user routes:', error.message);
  userRoutes = express.Router();
}

try {
  productRoutes = require('./routes/productRoutes'); 
  console.log('✓ Product routes loaded');
} catch (error) {
  console.error('✗ Failed to load product routes:', error.message);
  productRoutes = express.Router();
}

try {
  orderRoutes = require('./routes/orderRoutes');
  console.log('✓ Order routes loaded');
} catch (error) {
  console.error('✗ Failed to load order routes:', error.message);
  orderRoutes = express.Router();
}

try {
  cartRoutes = require('./routes/cartRoutes'); 
  console.log('✓ Cart routes loaded');
} catch (error) {
  console.error('✗ Failed to load cart routes:', error.message);
  cartRoutes = express.Router();
}

try {
  wishlistRoutes = require('./routes/wishlistRoutes'); 
  console.log('✓ Wishlist routes loaded');
} catch (error) {
  console.error('✗ Failed to load wishlist routes:', error.message);
  wishlistRoutes = express.Router();
}

// Import payment routes - FIXED: Use require, not string
try {
  paymentRoutes = require('./routes/paymentRoutes');
  console.log('✓ Payment routes loaded');
} catch (error) {
  console.error('✗ Failed to load payment routes:', error.message);
  paymentRoutes = express.Router();
}

// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IMPORTANT: Webhook route MUST come before express.json() middleware
// This needs to be at the top level, not inside a route handler


// Routes - ORDER MATTERS! Put specific routes before generic ones
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/promo', promoRoutes);        // For public routes
app.use('/api/admin/promo', promoRoutes);  // For admin routes

// FIXED: Use the payment routes correctly
if (paymentRoutes) {
  app.use('/api/payments', paymentRoutes);
  console.log('✓ Payment routes registered at /api/payments');
}

// REMOVED: Duplicate userRoutes line
// app.use('/api/users', userRoutes); // This was duplicate - removed

// Add this after app.use('/api/promo', promoRoutes);
console.log('✓ Promo routes registered:');
console.log('  - POST /api/promo/validate');
console.log('  - GET /api/promo/valid');
console.log('  - POST /api/promo/apply');
console.log('  - GET /api/admin/promo');
console.log('  - GET /api/admin/promo/stats');
console.log('  - POST /api/admin/promo/bulk-delete');

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server only if not in test environment
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  
  // Connect to MongoDB
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/luxemarket')
    .then(() => {
      console.log('✓ Connected to MongoDB');
      app.listen(PORT, () => {
        console.log(`✓ Server running on port ${PORT}`);
        console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    })
    .catch(err => {
      console.error('✗ MongoDB connection error:', err);
      process.exit(1);
    });
}

module.exports = app;