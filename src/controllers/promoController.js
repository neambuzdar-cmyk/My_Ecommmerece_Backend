// src/controllers/promoController.js
const PromoCode = require('../models/PromoCode');
const Order = require('../models/Order');

// ==================== PUBLIC ROUTES ====================

// @desc    Validate promo code (public)
// @route   POST /api/promo/validate
// @access  Public
const validatePromoCode = async (req, res, next) => {
  try {
    const { code, orderAmount, userId } = req.body;

    const promo = await PromoCode.findOne({ code: code.toUpperCase() });

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Invalid promo code'
      });
    }

    // Check if promo is active and within date range
    if (!promo.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Promo code is expired or inactive'
      });
    }

    // Check minimum order amount
    if (orderAmount && orderAmount < promo.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of $${promo.minOrderAmount} required`
      });
    }

    // Check if user can use this promo
    if (userId && !promo.canUserUse(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You have reached the usage limit for this promo code'
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (orderAmount) {
      if (promo.discountType === 'percentage') {
        discountAmount = (orderAmount * promo.discountValue) / 100;
        if (promo.maxDiscount) {
          discountAmount = Math.min(discountAmount, promo.maxDiscount);
        }
      } else {
        discountAmount = promo.discountValue;
      }
    }

    res.json({
      success: true,
      data: {
        _id: promo._id,
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        discountAmount,
        maxDiscount: promo.maxDiscount,
        description: promo.description,
        minOrderAmount: promo.minOrderAmount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all valid promo codes (public)
// @route   GET /api/promo/valid
// @access  Public
const getValidPromoCodes = async (req, res, next) => {
  try {
    const now = new Date();
    const promos = await PromoCode.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $expr: { $or: [
        { $eq: ['$usageLimit', null] },
        { $lt: ['$usedCount', '$usageLimit'] }
      ] }
    }).select('code description discountType discountValue minOrderAmount maxDiscount endDate');

    res.json({
      success: true,
      data: promos
    });
  } catch (error) {
    next(error);
  }
};

// ==================== PROTECTED ROUTES ====================

// @desc    Apply promo code to order
// @route   POST /api/promo/apply
// @access  Private
const applyPromoCode = async (req, res, next) => {
  try {
    const { code, orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify order belongs to user
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const promo = await PromoCode.findOne({ code: code.toUpperCase() });

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Invalid promo code'
      });
    }

    // Validate promo
    if (!promo.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Promo code is expired or inactive'
      });
    }

    if (order.total < promo.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of $${promo.minOrderAmount} required`
      });
    }

    if (!promo.canUserUse(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You have reached the usage limit for this promo code'
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.discountType === 'percentage') {
      discountAmount = (order.total * promo.discountValue) / 100;
      if (promo.maxDiscount) {
        discountAmount = Math.min(discountAmount, promo.maxDiscount);
      }
    } else {
      discountAmount = promo.discountValue;
    }

    // Update order
    order.discount = {
      code: promo.code,
      type: promo.discountType,
      value: promo.discountValue,
      amount: discountAmount
    };
    order.finalTotal = order.total - discountAmount;
    await order.save();

    // Update promo usage
    promo.usedCount += 1;
    
    const userUsage = promo.userUsage.find(u => u.user.toString() === req.user._id.toString());
    if (userUsage) {
      userUsage.count += 1;
      userUsage.usedAt = new Date();
    } else {
      promo.userUsage.push({
        user: req.user._id,
        count: 1,
        usedAt: new Date()
      });
    }
    
    await promo.save();

    res.json({
      success: true,
      data: {
        orderId: order._id,
        originalTotal: order.total,
        discountAmount,
        finalTotal: order.finalTotal,
        promoCode: promo.code
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN PROMO ROUTES ====================

// @desc    Create promo code
// @route   POST /api/admin/promo
// @access  Admin
const createPromoCode = async (req, res, next) => {
  try {
    console.log('User creating promo:', req.user); // Add this
    console.log('Request body:', req.body); // Add this
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      perUserLimit,
      firstTimeOnly,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      isActive
    } = req.body;

    // Check if code already exists
    const existingPromo = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existingPromo) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists'
      });
    }

    const promo = await PromoCode.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || 0,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      perUserLimit: perUserLimit || 1,
      firstTimeOnly: firstTimeOnly || false,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      data: promo
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all promo codes
// @route   GET /api/admin/promo
// @access  Admin
const getPromoCodes = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      discountType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (status === 'active') {
      query.isActive = true;
      query.startDate = { $lte: new Date() };
      query.endDate = { $gte: new Date() };
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'expired') {
      query.endDate = { $lt: new Date() };
    } else if (status === 'upcoming') {
      query.startDate = { $gt: new Date() };
    }

    if (discountType && discountType !== 'all') {
      query.discountType = discountType;
    }

    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const promos = await PromoCode.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await PromoCode.countDocuments(query);

    res.json({
      success: true,
      data: promos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get promo code stats
// @route   GET /api/admin/promo/stats
// @access  Admin
const getPromoCodeStats = async (req, res, next) => {
  try {
    const now = new Date();

    const [
      total,
      active,
      expired,
      upcoming,
      totalUsage,
      totalDiscount
    ] = await Promise.all([
      PromoCode.countDocuments(),
      PromoCode.countDocuments({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      }),
      PromoCode.countDocuments({ endDate: { $lt: now } }),
      PromoCode.countDocuments({ startDate: { $gt: now } }),
      PromoCode.aggregate([
        { $group: { _id: null, total: { $sum: '$usedCount' } } }
      ]),
      Order.aggregate([
        { $match: { 'discount.amount': { $exists: true, $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$discount.amount' } } }
      ])
    ]);

    // Get most used promos
    const topPromos = await PromoCode.find()
      .sort({ usedCount: -1 })
      .limit(5)
      .select('code usedCount discountType discountValue');

    res.json({
      success: true,
      data: {
        overview: {
          total,
          active,
          expired,
          upcoming,
          totalUsage: totalUsage[0]?.total || 0,
          totalDiscount: totalDiscount[0]?.total || 0
        },
        topPromos
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export promo codes
// @route   GET /api/admin/promo/export
// @access  Admin
const exportPromoCodes = async (req, res, next) => {
  try {
    const promos = await PromoCode.find()
      .populate('createdBy', 'email')
      .lean();

    const fields = [
      'code',
      'description',
      'discountType',
      'discountValue',
      'minOrderAmount',
      'maxDiscount',
      'startDate',
      'endDate',
      'usageLimit',
      'usedCount',
      'isActive',
      'createdAt'
    ];

    const csv = [
      fields.join(','),
      ...promos.map(promo => 
        fields.map(f => {
          const value = promo[f];
          if (value instanceof Date) return value.toISOString();
          if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
          return value;
        }).join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=promo-codes.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single promo code
// @route   GET /api/admin/promo/:id
// @access  Admin
const getPromoCode = async (req, res, next) => {
  try {
    const promo = await PromoCode.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('userUsage.user', 'firstName lastName email');

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    res.json({
      success: true,
      data: promo
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update promo code
// @route   PUT /api/admin/promo/:id
// @access  Admin
const updatePromoCode = async (req, res, next) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      perUserLimit,
      firstTimeOnly,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      isActive
    } = req.body;

    // Check if code is being changed and already exists
    if (code && code.toUpperCase() !== promo.code) {
      const existingPromo = await PromoCode.findOne({ 
        code: code.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existingPromo) {
        return res.status(400).json({
          success: false,
          message: 'Promo code already exists'
        });
      }
      promo.code = code.toUpperCase();
    }

    promo.description = description !== undefined ? description : promo.description;
    promo.discountType = discountType || promo.discountType;
    promo.discountValue = discountValue || promo.discountValue;
    promo.minOrderAmount = minOrderAmount !== undefined ? minOrderAmount : promo.minOrderAmount;
    promo.maxDiscount = maxDiscount !== undefined ? maxDiscount : promo.maxDiscount;
    promo.startDate = startDate || promo.startDate;
    promo.endDate = endDate || promo.endDate;
    promo.usageLimit = usageLimit !== undefined ? usageLimit : promo.usageLimit;
    promo.perUserLimit = perUserLimit || promo.perUserLimit;
    promo.firstTimeOnly = firstTimeOnly !== undefined ? firstTimeOnly : promo.firstTimeOnly;
    promo.applicableProducts = applicableProducts || promo.applicableProducts;
    promo.applicableCategories = applicableCategories || promo.applicableCategories;
    promo.excludedProducts = excludedProducts || promo.excludedProducts;
    promo.isActive = isActive !== undefined ? isActive : promo.isActive;

    await promo.save();

    res.json({
      success: true,
      data: promo
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle promo code status
// @route   PATCH /api/admin/promo/:id/toggle
// @access  Admin
const togglePromoCode = async (req, res, next) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    
    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    promo.isActive = !promo.isActive;
    await promo.save();

    res.json({
      success: true,
      data: promo
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete promo code
// @route   DELETE /api/admin/promo/:id
// @access  Admin
const deletePromoCode = async (req, res, next) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    
    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    // Check if promo has been used
    if (promo.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete promo code that has been used'
      });
    }

    await promo.deleteOne();

    res.json({
      success: true,
      message: 'Promo code deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk delete promo codes
// @route   POST /api/admin/promo/bulk-delete
// @access  Admin
const bulkDeletePromoCodes = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of promo code IDs'
      });
    }

    // Check if any have been used
    const usedPromos = await PromoCode.find({
      _id: { $in: ids },
      usedCount: { $gt: 0 }
    });

    if (usedPromos.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${usedPromos.length} promo codes have been used and cannot be deleted`,
        usedCodes: usedPromos.map(p => p.code)
      });
    }

    const result = await PromoCode.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `${result.deletedCount} promo codes deleted successfully`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update promo status
// @route   POST /api/admin/promo/bulk-status
// @access  Admin
const bulkUpdatePromoStatus = async (req, res, next) => {
  try {
    const { ids, isActive } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of promo code IDs'
      });
    }

    const result = await PromoCode.updateMany(
      { _id: { $in: ids } },
      { $set: { isActive } }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} promo codes ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    next(error);
  }
};

// ==================== EXPORT ALL FUNCTIONS ====================
module.exports = {
  // Public
  validatePromoCode,
  getValidPromoCodes,
  
  // Protected
  applyPromoCode,
  
  // Admin
  createPromoCode,
  getPromoCodes,
  getPromoCodeStats,
  exportPromoCodes,
  getPromoCode,
  updatePromoCode,
  togglePromoCode,
  deletePromoCode,
  bulkDeletePromoCodes,
  bulkUpdatePromoStatus
};