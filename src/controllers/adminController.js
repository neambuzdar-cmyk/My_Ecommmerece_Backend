const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

// ==================== PRODUCT MANAGEMENT ====================

// @desc    Create product
// @route   POST /api/admin/products
const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all products (including inactive)
// @route   GET /api/admin/products
const getAllProductsAdmin = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const products = await Product.find({})
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort('-createdAt');
    
    const total = await Product.countDocuments();
    
    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/admin/products/:id
const getProductByIdAdmin = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/admin/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/admin/products/:id
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Duplicate product
// @route   POST /api/admin/products/:id/duplicate
const duplicateProduct = async (req, res, next) => {
  try {
    const originalProduct = await Product.findById(req.params.id);
    if (!originalProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const duplicateData = originalProduct.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    
    duplicateData.sku = `${originalProduct.sku}-COPY-${Date.now()}`;
    duplicateData.name = `${originalProduct.name} (Copy)`;
    duplicateData.isActive = false;

    const duplicatedProduct = await Product.create(duplicateData);
    res.status(201).json({ success: true, data: duplicatedProduct });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle product active status
// @route   PATCH /api/admin/products/:id/toggle-active
const toggleProductActive = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    product.isActive = !product.isActive;
    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle product featured status
// @route   PATCH /api/admin/products/:id/toggle-featured
const toggleProductFeatured = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    product.isFeatured = !product.isFeatured;
    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product stock
// @route   PATCH /api/admin/products/:id/stock
const updateProductStock = async (req, res, next) => {
  try {
    const { stock } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock },
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// ==================== BULK OPERATIONS ====================

// @desc    Bulk delete products
// @route   POST /api/admin/products/bulk/delete
const bulkDeleteProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of product IDs' });
    }
    const result = await Product.deleteMany({ _id: { $in: productIds } });
    res.json({ success: true, message: `${result.deletedCount} products deleted successfully` });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update status
// @route   POST /api/admin/products/bulk/status
const bulkUpdateStatus = async (req, res, next) => {
  try {
    const { productIds, isActive } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of product IDs' });
    }
    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { isActive } }
    );
    res.json({ success: true, message: `${result.modifiedCount} products updated` });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update featured
// @route   POST /api/admin/products/bulk/featured
const bulkUpdateFeatured = async (req, res, next) => {
  try {
    const { productIds, isFeatured } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of product IDs' });
    }
    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { isFeatured } }
    );
    res.json({ success: true, message: `${result.modifiedCount} products updated` });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk duplicate products
// @route   POST /api/admin/products/bulk/duplicate
const bulkDuplicateProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of product IDs' });
    }
    
    const originalProducts = await Product.find({ _id: { $in: productIds } });
    const duplicatePromises = originalProducts.map(async (product) => {
      const duplicateData = product.toObject();
      delete duplicateData._id;
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;
      duplicateData.sku = `${product.sku}-COPY-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      duplicateData.name = `${product.name} (Copy)`;
      duplicateData.isActive = false;
      return Product.create(duplicateData);
    });

    const duplicatedProducts = await Promise.all(duplicatePromises);
    res.status(201).json({ 
      success: true, 
      message: `${duplicatedProducts.length} products duplicated successfully`,
      data: duplicatedProducts 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update products
// @route   POST /api/admin/products/bulk/update
const bulkUpdateProducts = async (req, res, next) => {
  try {
    const { productIds, updateData } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of product IDs' });
    }
    delete updateData._id;
    delete updateData.sku;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: updateData }
    );
    res.json({ success: true, message: `${result.modifiedCount} products updated` });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk add to category
// @route   POST /api/admin/products/bulk/category
const bulkAddToCategory = async (req, res, next) => {
  try {
    const { productIds, category, subcategory } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of product IDs' });
    }
    const updateData = { category };
    if (subcategory) updateData.subcategory = subcategory;

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: updateData }
    );
    res.json({ success: true, message: `${result.modifiedCount} products updated` });
  } catch (error) {
    next(error);
  }
};

// ==================== USER MANAGEMENT ====================

// @desc    Get all users
// @route   GET /api/admin/users
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password');
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/admin/users/:id
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
const deleteUser = async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Change user role
// @route   PATCH /api/admin/users/:id/role
const changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify user
// @route   PATCH /api/admin/users/:id/verify
const verifyUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { new: true }
    ).select('-password');
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user orders
// @route   GET /api/admin/users/:id/orders
const getUserOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.params.id });
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

// ==================== ORDER MANAGEMENT ====================

// @desc    Get all orders
// @route   GET /api/admin/orders
const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name price');
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/admin/orders/:id
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'firstName lastName email phone')
      .populate('items.product', 'name price sku');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Update payment status
// @route   PUT /api/admin/orders/:id/payment
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { paymentStatus },
      { new: true }
    );
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Add tracking number
// @route   PUT /api/admin/orders/:id/tracking
const addTrackingNumber = async (req, res, next) => {
  try {
    const { trackingNumber } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { trackingNumber, status: 'shipped' },
      { new: true }
    );
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark as delivered
// @route   PUT /api/admin/orders/:id/delivered
const markAsDelivered = async (req, res, next) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'delivered',
        deliveredAt: new Date(),
        paymentStatus: 'paid'
      },
      { new: true }
    );
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete order
// @route   DELETE /api/admin/orders/:id
const deleteOrder = async (req, res, next) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order stats
// @route   GET /api/admin/orders/stats
const getOrderStats = async (req, res, next) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    
    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        deliveredOrders,
        revenue: totalRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== EXPORT ALL FUNCTIONS ====================
module.exports = {
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
};