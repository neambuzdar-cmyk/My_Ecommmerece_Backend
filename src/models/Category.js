// src/controllers/categoryController.js
const Product = require('../models/Product');

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
          // Get sample product for image
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
          name: { $ne: null, $ne: '' } // Exclude uncategorized
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

    if (uncategorizedProducts > 0) {
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

    res.json({
      success: true,
      data: {
        categories: paginatedCategories,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredCategories.length,
          pages: Math.ceil(filteredCategories.length / parseInt(limit))
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

    // Get products in this category
    const products = await Product.find({ 
      category: decodedName 
    }).select('name price stock isActive images createdAt');

    // Calculate stats
    const productCount = products.length;
    const activeProductCount = products.filter(p => p.isActive).length;
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);

    // Get subcategories
    const subcategories = await Product.aggregate([
      { $match: { category: decodedName } },
      {
        $group: {
          _id: '$subcategory',
          productCount: { $sum: 1 }
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
          productCount: 1
        }
      }
    ]);

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
        products
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

    res.json({
      success: true,
      data: categories.map(name => ({
        _id: name,
        name: name,
        slug: name.toLowerCase().replace(/\s+/g, '-')
      }))
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategoryStats,
  getCategoryByName,
  getCategoryList
};