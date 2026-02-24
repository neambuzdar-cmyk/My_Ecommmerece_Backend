// src/controllers/categoryController.js
const Product = require('../models/Product');

// ==================== CATEGORY STATS & LISTING ====================

// @desc    Get all categories with product counts and stats
// @route   GET /api/admin/categories/stats
// @access  Private/Admin
const getCategoryStats = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 12, 
      search = '',
      sortBy = 'productCount',
      sortOrder = 'desc',
      hasProducts
    } = req.query;

    // Aggregate products by category
    const categoryStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          activeProductCount: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          totalValue: {
            $sum: { $multiply: ['$price', '$stock'] }
          },
          // Get first image as sample
          sampleImage: { $first: '$images' }
        }
      },
      {
        $project: {
          _id: 1,
          name: '$_id',
          slug: {
            $toLower: {
              $replaceAll: {
                input: '$_id',
                find: ' ',
                replacement: '-'
              }
            }
          },
          productCount: 1,
          activeProductCount: 1,
          totalValue: 1,
          image: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$sampleImage', []] } }, 0] },
              then: { $arrayElemAt: ['$sampleImage.url', 0] },
              else: null
            }
          }
        }
      },
      {
        $match: {
          name: { $ne: null, $ne: '' } // Exclude empty categories
        }
      }
    ]);

    // Add "Uncategorized" category for products without category
    const uncategorizedProducts = await Product.countDocuments({ 
      $or: [
        { category: { $exists: false } },
        { category: null },
        { category: '' }
      ]
    });

    if (uncategorizedProducts > 0) {
      const uncategorizedActive = await Product.countDocuments({
        $or: [
          { category: { $exists: false } },
          { category: null },
          { category: '' }
        ],
        isActive: true
      });

      const uncategorizedValue = await Product.aggregate([
        {
          $match: {
            $or: [
              { category: { $exists: false } },
              { category: null },
              { category: '' }
            ]
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$price', '$stock'] } }
          }
        }
      ]);

      categoryStats.push({
        _id: 'uncategorized',
        name: 'Uncategorized',
        slug: 'uncategorized',
        productCount: uncategorizedProducts,
        activeProductCount: uncategorizedActive,
        totalValue: uncategorizedValue[0]?.total || 0,
        image: null
      });
    }

    // Apply search filter
    let filteredCategories = categoryStats;
    if (search) {
      filteredCategories = filteredCategories.filter(cat => 
        cat.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply hasProducts filter
    if (hasProducts === 'true') {
      filteredCategories = filteredCategories.filter(c => c.productCount > 0);
    } else if (hasProducts === 'false') {
      filteredCategories = filteredCategories.filter(c => c.productCount === 0);
    }

    // Sort categories
    filteredCategories.sort((a, b) => {
      let aVal, bVal;
      
      if (sortBy === 'name') {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else if (sortBy === 'productCount') {
        aVal = a.productCount;
        bVal = b.productCount;
      } else if (sortBy === 'totalValue') {
        aVal = a.totalValue;
        bVal = b.totalValue;
      } else {
        aVal = a.productCount;
        bVal = b.productCount;
      }
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Calculate total stats
    const totalCategories = filteredCategories.length;
    const totalProducts = filteredCategories.reduce((sum, cat) => sum + cat.productCount, 0);
    const totalValue = filteredCategories.reduce((sum, cat) => sum + cat.totalValue, 0);
    const categoriesWithProducts = filteredCategories.filter(c => c.productCount > 0).length;

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedCategories = filteredCategories.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredCategories.length / parseInt(limit));

    res.json({
      success: true,
      data: {
        categories: paginatedCategories,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredCategories.length,
          pages: totalPages
        },
        stats: {
          totalCategories,
          totalProducts,
          totalValue,
          categoriesWithProducts,
          avgProductsPerCat: totalCategories ? (totalProducts / totalCategories).toFixed(1) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category details with products
// @route   GET /api/admin/categories/:name
// @access  Private/Admin
const getCategoryByName = async (req, res, next) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);

    // Get all products in this category
    const products = await Product.find({ 
      category: decodedName 
    }).select('name price stock isActive images sku createdAt');

    // Calculate stats
    const productCount = products.length;
    const activeProductCount = products.filter(p => p.isActive).length;
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);

    // Get subcategories with counts
    const subcategories = await Product.aggregate([
      { $match: { category: decodedName } },
      {
        $group: {
          _id: '$subcategory',
          productCount: { $sum: 1 },
          activeProductCount: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          totalValue: {
            $sum: { $multiply: ['$price', '$stock'] }
          }
        }
      },
      {
        $match: {
          _id: { $ne: null, $ne: '' }
        }
      },
      {
        $project: {
          name: '$_id',
          slug: {
            $toLower: {
              $replaceAll: {
                input: '$_id',
                find: ' ',
                replacement: '-'
              }
            }
          },
          productCount: 1,
          activeProductCount: 1,
          totalValue: 1
        }
      }
    ]);

    // Get recent products (last 5)
    const recentProducts = await Product.find({ category: decodedName })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name price stock isActive images createdAt');

    res.json({
      success: true,
      data: {
        _id: decodedName,
        name: decodedName,
        slug: decodedName.toLowerCase().replace(/\s+/g, '-'),
        productCount,
        activeProductCount,
        totalValue,
        subcategories,
        recentProducts,
        products // Full product list
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all unique categories (just names)
// @route   GET /api/admin/categories/list
// @access  Private/Admin
const getCategoryList = async (req, res, next) => {
  try {
    const categories = await Product.distinct('category', {
      category: { $ne: null, $ne: '' }
    });

    // Get product counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (name) => {
        const count = await Product.countDocuments({ category: name });
        const activeCount = await Product.countDocuments({ 
          category: name, 
          isActive: true 
        });
        return {
          _id: name,
          name: name,
          slug: name.toLowerCase().replace(/\s+/g, '-'),
          productCount: count,
          activeProductCount: activeCount
        };
      })
    );

    res.json({
      success: true,
      data: categoriesWithCounts
    });
  } catch (error) {
    next(error);
  }
};

// ==================== CATEGORY MANAGEMENT (CRUD) ====================

// @desc    Create new category
// @route   POST /api/admin/categories
// @access  Private/Admin
const createCategory = async (req, res, next) => {
  try {
    const { name, description, image } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    // Check if category already exists
    const existingCategory = await Product.findOne({ 
      category: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    // Since category is just a string in products, we don't actually create a category record
    // We just verify it doesn't exist and return success
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      });
    }

    res.status(201).json({
      success: true,
      data: {
        _id: name,
        name: name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        description: description || '',
        image: image || null,
        productCount: 0,
        activeProductCount: 0,
        totalValue: 0,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:name
// @access  Private/Admin
const updateCategory = async (req, res, next) => {
  try {
    const { name } = req.params;
    const { newName, description, image } = req.body;
    const decodedOldName = decodeURIComponent(name);

    if (!newName || !newName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    // Update all products with this category to the new name
    if (newName && newName !== decodedOldName) {
      await Product.updateMany(
        { category: decodedOldName },
        { $set: { category: newName } }
      );
    }

    // Since we don't have a separate category collection, we return the updated info
    const productCount = await Product.countDocuments({ category: newName });
    const activeProductCount = await Product.countDocuments({ 
      category: newName, 
      isActive: true 
    });

    res.json({
      success: true,
      data: {
        _id: newName,
        name: newName,
        slug: newName.toLowerCase().replace(/\s+/g, '-'),
        description: description || '',
        image: image || null,
        productCount,
        activeProductCount,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:name
// @access  Private/Admin
const deleteCategory = async (req, res, next) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);

    // Check if category has products
    const productCount = await Product.countDocuments({ category: decodedName });
    
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category that has ${productCount} products. Move products to another category first.`
      });
    }

    // Since it's just a string in products, deletion just means no products use this category
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle category status (affects all products in category)
// @route   PATCH /api/admin/categories/:name/toggle
// @access  Private/Admin
const toggleCategoryStatus = async (req, res, next) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);
    const { isActive } = req.body;

    // Update all products in this category
    await Product.updateMany(
      { category: decodedName },
      { $set: { isActive: isActive } }
    );

    const productCount = await Product.countDocuments({ category: decodedName });
    const activeProductCount = await Product.countDocuments({ 
      category: decodedName, 
      isActive: true 
    });

    res.json({
      success: true,
      data: {
        _id: decodedName,
        name: decodedName,
        isActive,
        productCount,
        activeProductCount,
        message: `Category ${isActive ? 'activated' : 'deactivated'}. ${productCount} products affected.`
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== BULK OPERATIONS ====================

// @desc    Bulk delete categories
// @route   POST /api/admin/categories/bulk/delete
// @access  Private/Admin
const bulkDeleteCategories = async (req, res, next) => {
  try {
    const { categoryNames } = req.body;

    if (!categoryNames || !Array.isArray(categoryNames) || categoryNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of category names'
      });
    }

    // Check if any categories have products
    const categoriesWithProducts = await Product.distinct('category', {
      category: { $in: categoryNames }
    });

    if (categoriesWithProducts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some categories have products. Move products first.',
        categoriesWithProducts
      });
    }

    res.json({
      success: true,
      message: `${categoryNames.length} categories deleted successfully`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update category status
// @route   POST /api/admin/categories/bulk/status
// @access  Private/Admin
const bulkUpdateCategoryStatus = async (req, res, next) => {
  try {
    const { categoryNames, isActive } = req.body;

    if (!categoryNames || !Array.isArray(categoryNames) || categoryNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of category names'
      });
    }

    // Update all products in these categories
    const result = await Product.updateMany(
      { category: { $in: categoryNames } },
      { $set: { isActive } }
    );

    res.json({
      success: true,
      message: `${categoryNames.length} categories updated. ${result.modifiedCount} products affected.`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Merge categories (move all products from one category to another)
// @route   POST /api/admin/categories/merge
// @access  Private/Admin
const mergeCategories = async (req, res, next) => {
  try {
    const { fromCategory, toCategory } = req.body;

    if (!fromCategory || !toCategory) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both source and destination categories'
      });
    }

    // Move all products from fromCategory to toCategory
    const result = await Product.updateMany(
      { category: fromCategory },
      { $set: { category: toCategory } }
    );

    res.json({
      success: true,
      message: `Moved ${result.modifiedCount} products from "${fromCategory}" to "${toCategory}"`,
      data: {
        fromCategory,
        toCategory,
        productsMoved: result.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== EXPORT ALL FUNCTIONS ====================

module.exports = {
  // Stats & Listing
  getCategoryStats,
  getCategoryByName,
  getCategoryList,
  
  // CRUD Operations
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  
  // Bulk Operations
  bulkDeleteCategories,
  bulkUpdateCategoryStatus,
  mergeCategories
};