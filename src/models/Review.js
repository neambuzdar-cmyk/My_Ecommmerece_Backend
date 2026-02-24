const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: [true, 'Review title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  images: [{
    url: String,
    alt: String
  }],
  adminReply: {
    comment: String,
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    repliedAt: Date
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  helpful: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    count: {
      type: Number,
      default: 0
    }
  }],
  helpfulCount: {
    type: Number,
    default: 0
  },
  reported: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    reportedAt: Date
  }],
  reportCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Ensure one review per product per user
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Update product rating when review is saved
reviewSchema.post('save', async function() {
  await updateProductRating(this.product);
});

reviewSchema.post('findOneAndUpdate', async function() {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    await updateProductRating(doc.product);
  }
});

reviewSchema.post('deleteOne', async function() {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    await updateProductRating(doc.product);
  }
});

async function updateProductRating(productId) {
  const Review = mongoose.model('Review');
  const Product = mongoose.model('Product');
  
  const stats = await Review.aggregate([
    { $match: { product: productId, status: 'approved' } },
    { $group: {
        _id: '$product',
        average: { $avg: '$rating' },
        count: { $sum: 1 },
        breakdown: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (stats.length > 0) {
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].breakdown.forEach(rating => {
      breakdown[rating]++;
    });

    await Product.findByIdAndUpdate(productId, {
      'ratings.average': stats[0].average,
      'ratings.count': stats[0].count,
      'ratings.breakdown': breakdown
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      'ratings.average': 0,
      'ratings.count': 0,
      'ratings.breakdown': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    });
  }
}

module.exports = mongoose.model('Review', reviewSchema);