// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, admin } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Import category controller and routes
const categoryRoutes = require('./categoryRoutes');

// Import existing controllers
const {
  // Product Management
  createProduct,
  getAllProductsAdmin,
  getProductByIdAdmin,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  toggleProductActive,
  toggleProductFeatured,
  updateProductStock,
  
  // Bulk Operations
  bulkDeleteProducts,
  bulkUpdateStatus,
  bulkUpdateFeatured,
  bulkDuplicateProducts,
  bulkUpdateProducts,
  bulkAddToCategory,
  
  // User Management
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  changeUserRole,
  verifyUser,
  getUserOrders,
  
  // Order Management
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  addTrackingNumber,
  markAsDelivered,
  deleteOrder,
  getOrderStats
} = require('../controllers/adminController');

// All routes require admin authentication
router.use(protect, admin);

// ==================== CATEGORY ROUTES ====================
// This MUST come before any routes with parameters
router.use('/categories', categoryRoutes);

// ==================== BULK OPERATIONS ====================
router.post('/products/bulk/delete', bulkDeleteProducts);
router.post('/products/bulk/status', bulkUpdateStatus);
router.post('/products/bulk/featured', bulkUpdateFeatured);
router.post('/products/bulk/duplicate', bulkDuplicateProducts);
router.post('/products/bulk/update', bulkUpdateProducts);
router.post('/products/bulk/category', bulkAddToCategory);

// ==================== PRODUCT MANAGEMENT ====================
router.post('/products', createProduct);
router.get('/products', getAllProductsAdmin);
router.get('/products/:id', getProductByIdAdmin);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/duplicate', duplicateProduct);
router.patch('/products/:id/toggle-active', toggleProductActive);
router.patch('/products/:id/toggle-featured', toggleProductFeatured);
router.patch('/products/:id/stock', updateProductStock);

// ==================== USER MANAGEMENT ====================
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/role', changeUserRole);
router.patch('/users/:id/verify', verifyUser);
router.get('/users/:id/orders', getUserOrders);

// ==================== ORDER MANAGEMENT ====================
router.get('/orders/stats', getOrderStats);  
router.get('/orders', getAllOrders);
router.get('/orders/:id', getOrderById);
router.put('/orders/:id/status', updateOrderStatus);
router.put('/orders/:id/payment', updatePaymentStatus);
router.put('/orders/:id/tracking', addTrackingNumber);
router.put('/orders/:id/delivered', markAsDelivered);
router.delete('/orders/:id', deleteOrder);

module.exports = router;