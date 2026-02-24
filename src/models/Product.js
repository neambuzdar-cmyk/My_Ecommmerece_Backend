const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  alt: { type: String, default: '' },
  isPrimary: { type: Boolean, default: false }
});

const attributeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  values: [{ type: String, required: true }]
});

const ratingSchema = new mongoose.Schema({
  average: { type: Number, default: 0, min: 0, max: 5 },
  count: { type: Number, default: 0 },
  breakdown: {
    1: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    4: { type: Number, default: 0 },
    5: { type: Number, default: 0 }
  }
}, { _id: false });

const productSchema = new mongoose.Schema({
  ratings: {
  average: { type: Number, default: 0, min: 0, max: 5 },
  count: { type: Number, default: 0 },
  breakdown: {
    1: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    4: { type: Number, default: 0 },
    5: { type: Number, default: 0 }
  }
},
  name: { type: String, required: [true, 'Product name is required'] },
  description: { type: String, required: [true, 'Description is required'] },
  price: { type: Number, required: [true, 'Price is required'], min: 0 },
  comparePrice: { type: Number, min: 0 },
  category: { type: String, required: [true, 'Category is required'] },
  subcategory: { type: String },
  images: [imageSchema],
  stock: { type: Number, required: true, default: 0, min: 0 },
  sku: { type: String, unique: true, required: true },
  attributes: [attributeSchema],
  ratings: { type: ratingSchema, default: () => ({}) },
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Index for search functionality
productSchema.index({ name: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);