const Product = require('../models/Product');

// ==================== PUBLIC PRODUCT APIS ====================

// @desc    Get all products with filters
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
  try {
    const { 
      category, 
      minPrice, 
      maxPrice, 
      search, 
      sort,
      page = 1, 
      limit = 10 
    } = req.query;

    // Build query - only show active products to public
    let query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Sort options
    let sortOption = {};
    if (sort === 'price-asc') sortOption.price = 1;
    else if (sort === 'price-desc') sortOption.price = -1;
    else if (sort === 'newest') sortOption.createdAt = -1;
    else if (sort === 'rating') sortOption['ratings.average'] = -1;
    else sortOption.createdAt = -1;

    // Execute query
    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if ID is valid MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }
    
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Only show active products to public
    if (!product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not available'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isFeatured: true, isActive: true })
      .limit(8);

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:cat
// @access  Public
const getProductsByCategory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find({ 
      category: req.params.cat,
      isActive: true 
    })
    .skip(skip)
    .limit(Number(limit));

    const total = await Product.countDocuments({ 
      category: req.params.cat, 
      isActive: true 
    });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
const searchProducts = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(
      { $text: { $search: q }, isActive: true },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(Number(limit));

    const total = await Product.countDocuments({ 
      $text: { $search: q },
      isActive: true 
    });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN SINGLE OPERATIONS ====================

// @desc    Create single product
// @route   POST /api/admin/products
// @access  Admin
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      comparePrice,
      category,
      subcategory,
      images,
      stock,
      sku,
      attributes,
      isFeatured,
      isActive
    } = req.body;

    // Check if SKU already exists
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this SKU already exists'
      });
    }

    // Create product
    const product = await Product.create({
      name,
      description,
      price,
      comparePrice,
      category,
      subcategory,
      images: images || [],
      stock: stock || 0,
      sku,
      attributes: attributes || [],
      isFeatured: isFeatured || false,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all products (including inactive)
// @route   GET /api/admin/products
// @access  Admin
const getAllProductsAdmin = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10,
      category,
      isActive,
      isFeatured,
      search
    } = req.query;

    let query = {};

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID (admin)
// @route   GET /api/admin/products/:id
// @access  Admin
const getProductByIdAdmin = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update single product
// @route   PUT /api/admin/products/:id
// @access  Admin
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete single product
// @route   DELETE /api/admin/products/:id
// @access  Admin
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Duplicate single product
// @route   POST /api/admin/products/:id/duplicate
// @access  Admin
const duplicateProduct = async (req, res, next) => {
  try {
    const originalProduct = await Product.findById(req.params.id);

    if (!originalProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Create duplicate with new SKU
    const duplicateData = originalProduct.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    
    // Generate new SKU
    duplicateData.sku = `${originalProduct.sku}-COPY-${Date.now()}`;
    duplicateData.name = `${originalProduct.name} (Copy)`;
    duplicateData.isActive = false; // New copies are inactive by default

    const duplicatedProduct = await Product.create(duplicateData);

    res.status(201).json({
      success: true,
      data: duplicatedProduct
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle product active status
// @route   PATCH /api/admin/products/:id/toggle-active
// @access  Admin
const toggleProductActive = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle product featured status
// @route   PATCH /api/admin/products/:id/toggle-featured
// @access  Admin
const toggleProductFeatured = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isFeatured = !product.isFeatured;
    await product.save();

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product stock
// @route   PATCH /api/admin/products/:id/stock
// @access  Admin
const updateProductStock = async (req, res, next) => {
  try {
    const { stock } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// ==================== BULK OPERATIONS ====================

// @desc    Bulk delete products
// @route   POST /api/admin/products/bulk/delete
// @access  Admin
const bulkDeleteProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of product IDs'
      });
    }

    const result = await Product.deleteMany({ _id: { $in: productIds } });

    res.json({
      success: true,
      message: `${result.deletedCount} products deleted successfully`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update product status (active/inactive)
// @route   POST /api/admin/products/bulk/status
// @access  Admin
const bulkUpdateStatus = async (req, res, next) => {
  try {
    const { productIds, isActive } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of product IDs'
      });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { isActive } }
    );

    const statusText = isActive ? 'activated' : 'deactivated';
    res.json({
      success: true,
      message: `${result.modifiedCount} products ${statusText} successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update product featured status
// @route   POST /api/admin/products/bulk/featured
// @access  Admin
const bulkUpdateFeatured = async (req, res, next) => {
  try {
    const { productIds, isFeatured } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of product IDs'
      });
    }

    if (typeof isFeatured !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isFeatured must be a boolean value'
      });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { isFeatured } }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} products updated successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk duplicate products
// @route   POST /api/admin/products/bulk/duplicate
// @access  Admin
const bulkDuplicateProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of product IDs'
      });
    }

    const originalProducts = await Product.find({ _id: { $in: productIds } });
    
    if (originalProducts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No products found with the provided IDs'
      });
    }

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
      data: {
        duplicatedCount: duplicatedProducts.length,
        products: duplicatedProducts
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update products (custom fields)
// @route   POST /api/admin/products/bulk/update
// @access  Admin
const bulkUpdateProducts = async (req, res, next) => {
  try {
    const { productIds, updateData } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of product IDs'
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide update data'
      });
    }

    // Remove fields that shouldn't be bulk updated
    delete updateData._id;
    delete updateData.sku;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} products updated successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk add to category
// @route   POST /api/admin/products/bulk/category
// @access  Admin
const bulkAddToCategory = async (req, res, next) => {
  try {
    const { productIds, category, subcategory } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of product IDs'
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a category'
      });
    }

    const updateData = { category };
    if (subcategory) updateData.subcategory = subcategory;

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} products moved to category "${category}"`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== EXPORT ALL FUNCTIONS ====================
module.exports = {
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
};