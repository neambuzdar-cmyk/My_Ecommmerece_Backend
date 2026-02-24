const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');

// ==================== PUBLIC/USER REVIEW APIS ====================

// @desc    Create product review
// @route   POST /api/products/:productId/reviews
// @access  Private (must have purchased product)
const createReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { rating, title, comment, images } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has purchased this product
    const hasPurchased = await Order.findOne({
      user: req.user._id,
      'items.product': productId,
      status: 'delivered'
    });

    if (!hasPurchased) {
      return res.status(403).json({
        success: false,
        message: 'You can only review products you have purchased'
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      product: productId,
      user: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    // Create review
    const review = await Review.create({
      product: productId,
      user: req.user._id,
      order: hasPurchased._id,
      rating,
      title,
      comment,
      images: images || [],
      isVerifiedPurchase: true,
      status: 'pending'
    });

    await review.populate('user', 'firstName lastName avatar');

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product reviews
// @route   GET /api/products/:productId/reviews
// @access  Public
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;

    const query = { 
      product: productId,
      status: 'approved' 
    };

    const skip = (Number(page) - 1) * Number(limit);

    let sortOption = {};
    if (sort === 'newest') sortOption.createdAt = -1;
    if (sort === 'oldest') sortOption.createdAt = 1;
    if (sort === 'highest') sortOption.rating = -1;
    if (sort === 'lowest') sortOption.rating = 1;
    if (sort === 'helpful') sortOption.helpfulCount = -1;

    const reviews = await Review.find(query)
      .populate('user', 'firstName lastName avatar')
      .populate('adminReply.repliedBy', 'firstName lastName role')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    const total = await Review.countDocuments(query);

    // Get rating summary
    const ratingSummary = await Review.aggregate([
      { $match: { product: productId, status: 'approved' } },
      { $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        ratingSummary,
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

// @desc    Update own review
// @route   PUT /api/reviews/:reviewId
// @access  Private
const updateReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment, images } = req.body;

    const review = await Review.findOne({
      _id: reviewId,
      user: req.user._id
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update approved review'
      });
    }

    review.rating = rating || review.rating;
    review.title = title || review.title;
    review.comment = comment || review.comment;
    review.images = images || review.images;

    await review.save();

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete own review
// @route   DELETE /api/reviews/:reviewId
// @access  Private
const deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findOneAndDelete({
      _id: reviewId,
      user: req.user._id
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark review as helpful
// @route   POST /api/reviews/:reviewId/helpful
// @access  Private
const markHelpful = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user already marked helpful
    const alreadyHelpful = review.helpful.find(
      h => h.user.toString() === req.user._id.toString()
    );

    if (alreadyHelpful) {
      // Remove helpful mark
      review.helpful = review.helpful.filter(
        h => h.user.toString() !== req.user._id.toString()
      );
      review.helpfulCount -= 1;
    } else {
      // Add helpful mark
      review.helpful.push({ user: req.user._id });
      review.helpfulCount += 1;
    }

    await review.save();

    res.json({
      success: true,
      data: {
        helpfulCount: review.helpfulCount,
        isHelpful: !alreadyHelpful
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Report review
// @route   POST /api/reviews/:reviewId/report
// @access  Private
const reportReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if already reported
    const alreadyReported = review.reported.find(
      r => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReported) {
      return res.status(400).json({
        success: false,
        message: 'You have already reported this review'
      });
    }

    review.reported.push({
      user: req.user._id,
      reason,
      reportedAt: new Date()
    });
    review.reportCount += 1;

    await review.save();

    res.json({
      success: true,
      message: 'Review reported successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN REVIEW MANAGEMENT ====================

// @desc    Get all reviews (admin)
// @route   GET /api/admin/reviews
// @access  Admin
const getAllReviews = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status,
      productId,
      rating,
      sort = 'newest',
      search
    } = req.query;

    let query = {};

    if (status) query.status = status;
    if (productId) query.product = productId;
    if (rating) query.rating = Number(rating);
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);

    let sortOption = {};
    if (sort === 'newest') sortOption.createdAt = -1;
    if (sort === 'oldest') sortOption.createdAt = 1;
    if (sort === 'highest') sortOption.rating = -1;
    if (sort === 'lowest') sortOption.rating = 1;
    if (sort === 'reported') sortOption.reportCount = -1;

    const reviews = await Review.find(query)
      .populate('user', 'firstName lastName email')
      .populate('product', 'name sku')
      .populate('adminReply.repliedBy', 'firstName lastName')
      .populate('reported.user', 'firstName lastName email')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    const total = await Review.countDocuments(query);

    // Get stats
    const stats = await Review.aggregate([
      { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        stats,
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

// @desc    Get single review (admin)
// @route   GET /api/admin/reviews/:reviewId
// @access  Admin
const getReviewById = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId)
      .populate('user', 'firstName lastName email phone')
      .populate('product', 'name sku price images')
      .populate('order', 'orderNumber createdAt')
      .populate('adminReply.repliedBy', 'firstName lastName email')
      .populate('reported.user', 'firstName lastName email');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve review
// @route   PATCH /api/admin/reviews/:reviewId/approve
// @access  Admin
const approveReview = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.reviewId,
      { status: 'approved' },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject review
// @route   PATCH /api/admin/reviews/:reviewId/reject
// @access  Admin
const rejectReview = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.reviewId,
      { status: 'rejected' },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reply to review
// @route   POST /api/admin/reviews/:reviewId/reply
// @access  Admin
const replyToReview = async (req, res, next) => {
  try {
    const { comment } = req.body;

    const review = await Review.findByIdAndUpdate(
      req.params.reviewId,
      {
        adminReply: {
          comment,
          repliedBy: req.user._id,
          repliedAt: new Date()
        }
      },
      { new: true }
    ).populate('adminReply.repliedBy', 'firstName lastName');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete review (admin)
// @route   DELETE /api/admin/reviews/:reviewId
// @access  Admin
const deleteReviewAdmin = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN BULK OPERATIONS ====================

// @desc    Bulk approve reviews
// @route   POST /api/admin/reviews/bulk/approve
// @access  Admin
const bulkApproveReviews = async (req, res, next) => {
  try {
    const { reviewIds } = req.body;

    if (!reviewIds || !Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of review IDs'
      });
    }

    const result = await Review.updateMany(
      { _id: { $in: reviewIds } },
      { $set: { status: 'approved' } }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} reviews approved successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk reject reviews
// @route   POST /api/admin/reviews/bulk/reject
// @access  Admin
const bulkRejectReviews = async (req, res, next) => {
  try {
    const { reviewIds } = req.body;

    if (!reviewIds || !Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of review IDs'
      });
    }

    const result = await Review.updateMany(
      { _id: { $in: reviewIds } },
      { $set: { status: 'rejected' } }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} reviews rejected successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk delete reviews
// @route   POST /api/admin/reviews/bulk/delete
// @access  Admin
const bulkDeleteReviews = async (req, res, next) => {
  try {
    const { reviewIds } = req.body;

    if (!reviewIds || !Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of review IDs'
      });
    }

    const result = await Review.deleteMany({ _id: { $in: reviewIds } });

    res.json({
      success: true,
      message: `${result.deletedCount} reviews deleted successfully`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk reply to reviews
// @route   POST /api/admin/reviews/bulk/reply
// @access  Admin
const bulkReplyToReviews = async (req, res, next) => {
  try {
    const { reviewIds, comment } = req.body;

    if (!reviewIds || !Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of review IDs'
      });
    }

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reply comment'
      });
    }

    const result = await Review.updateMany(
      { _id: { $in: reviewIds } },
      {
        $set: {
          'adminReply.comment': comment,
          'adminReply.repliedBy': req.user._id,
          'adminReply.repliedAt': new Date()
        }
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} reviews replied successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // User/Public
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  markHelpful,
  reportReview,
  
  // Admin Single
  getAllReviews,
  getReviewById,
  approveReview,
  rejectReview,
  replyToReview,
  deleteReviewAdmin,
  
  // Admin Bulk
  bulkApproveReviews,
  bulkRejectReviews,
  bulkDeleteReviews,
  bulkReplyToReviews
};