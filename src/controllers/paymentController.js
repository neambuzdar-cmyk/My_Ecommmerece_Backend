// controllers/paymentController.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

// Helper function to generate order number
const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${year}${month}${day}-${random}`;
};

// Create payment intent
exports.createPaymentIntent = async (req, res) => {
  try {
    const { items, shippingAddress, total, subtotal, shipping, tax } = req.body;

    console.log('Creating payment intent for user:', req.user._id);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'usd',
      metadata: {
        userId: req.user._id.toString(),
        items: JSON.stringify(items),
        shippingAddress: JSON.stringify(shippingAddress),
        subtotal: subtotal?.toString() || '0',
        shipping: shipping?.toString() || '0',
        tax: tax?.toString() || '0'
      }
    });

    res.json({
      success: true,
      data: { 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  } catch (error) {
    console.error('Payment intent error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Handle failed payment from client
exports.handleFailedPaymentClient = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    console.log('Payment failed for user:', req.user._id, 'Intent:', paymentIntentId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Webhook handler
exports.stripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    console.log('Webhook received - Headers:', req.headers['content-type']);
    console.log('Webhook received - Body type:', typeof req.body);
    console.log('Webhook received - Is Buffer:', Buffer.isBuffer(req.body));

    // DEVELOPMENT MODE - No signature verification
    if (process.env.NODE_ENV !== 'production') {
      try {
        // If body is already an object, use it directly
        if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
          console.log('Body is already an object');
          event = req.body;
        } 
        // If body is a buffer, convert to string and parse
        else if (Buffer.isBuffer(req.body)) {
          console.log('Body is a buffer, converting to string');
          const payload = req.body.toString('utf8');
          event = JSON.parse(payload);
        }
        // If body is a string, parse it
        else if (typeof req.body === 'string') {
          console.log('Body is a string, parsing');
          event = JSON.parse(req.body);
        }
        else {
          console.log('Unknown body type:', typeof req.body);
          return res.status(400).send('Invalid body type');
        }
        
        console.log('✅ Event parsed successfully:', event.type);
      } catch (parseError) {
        console.error('❌ Failed to parse webhook body:', parseError);
        console.error('Body preview:', req.body?.toString?.()?.substring(0, 200) || 'No body');
        return res.status(400).send(`Parse Error: ${parseError.message}`);
      }
    } 
    // PRODUCTION MODE - Verify signature
    else {
      try {
        const payload = req.body.toString('utf8');
        event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
        console.log('✅ Signature verified, event:', event.type);
      } catch (verifyError) {
        console.error('❌ Signature verification failed:', verifyError.message);
        return res.status(400).send(`Webhook Error: ${verifyError.message}`);
      }
    }

    // Handle the event
    console.log(`🔔 Processing event: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('💰 Payment succeeded:', event.data.object.id);
        await handleSuccessfulPayment(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        console.log('❌ Payment failed:', event.data.object.id);
        await handleFailedPayment(event.data.object);
        break;
      case 'charge.succeeded':
        console.log('💳 Charge succeeded:', event.data.object.id);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    res.status(500).send(`Webhook Error: ${error.message}`);
  }
};

// Helper function for successful payment
const handleSuccessfulPayment = async (paymentIntent) => {
  console.log('🔄 Processing successful payment for:', paymentIntent.id);
  
  const metadata = paymentIntent.metadata;
  
  if (!metadata || !metadata.userId) {
    console.log('❌ No metadata or userId found');
    return;
  }

  try {
    // Check if order already exists
    const existingOrder = await Order.findOne({ paymentIntentId: paymentIntent.id });
    if (existingOrder) {
      console.log('📦 Order already exists:', existingOrder._id);
      return;
    }

    // Parse metadata
    console.log('📦 Metadata received:', metadata);
    
    let items, shippingAddress;
    
    try {
      items = JSON.parse(metadata.items);
      shippingAddress = JSON.parse(metadata.shippingAddress);
    } catch (parseError) {
      console.error('❌ Failed to parse metadata:', parseError);
      return;
    }
    
    console.log('📝 Creating order for user:', metadata.userId);
    console.log('📦 Items count:', items.length);
    
    // Format items for order
    const orderItems = items.map(item => ({
      product: item.product,
      name: item.name || 'Product',
      quantity: item.quantity,
      price: item.price || 0,
      image: item.image
    }));

    // Calculate totals
    const subtotal = parseFloat(metadata.subtotal) || 
                     orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = parseFloat(metadata.shipping) || 0;
    const tax = parseFloat(metadata.tax) || subtotal * 0.08;
    const total = paymentIntent.amount / 100;

    console.log('💰 Subtotal:', subtotal);
    console.log('💰 Total:', total);

    // GENERATE ORDER NUMBER MANUALLY
    const orderNumber = generateOrderNumber();
    console.log('📝 Generated order number:', orderNumber);

    // Create order with explicit orderNumber
    const order = new Order({
      orderNumber: orderNumber, // SET IT EXPLICITLY
      user: metadata.userId,
      items: orderItems,
      shippingAddress: {
        firstName: shippingAddress.firstName || '',
        lastName: shippingAddress.lastName || '',
        email: shippingAddress.email || '',
        phone: shippingAddress.phone || '',
        address: shippingAddress.address || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        zip: shippingAddress.zip || shippingAddress.zipCode || '',
        country: shippingAddress.country || 'US'
      },
      billingAddress: {
        firstName: shippingAddress.firstName || '',
        lastName: shippingAddress.lastName || '',
        email: shippingAddress.email || '',
        phone: shippingAddress.phone || '',
        address: shippingAddress.address || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        zip: shippingAddress.zip || shippingAddress.zipCode || '',
        country: shippingAddress.country || 'US'
      },
      payment: {
        method: 'card',
        status: 'paid',
        transactionId: paymentIntent.id,
        paidAt: new Date()
      },
      subtotal,
      shipping,
      tax,
      discount: 0,
      total,
      status: 'processing',
      paymentStatus: 'paid',
      paymentIntentId: paymentIntent.id
    });

    console.log('📝 Attempting to save order with orderNumber:', order.orderNumber);
    
    // Save the order
    const savedOrder = await order.save();
    
    console.log('✅ Order created successfully!');
    console.log('📦 Order ID:', savedOrder._id);
    console.log('🔢 Order number:', savedOrder.orderNumber);

    // Clear cart
    try {
      await Cart.findOneAndUpdate(
        { user: metadata.userId },
        { $set: { items: [] } }
      );
      console.log('🗑️ Cart cleared');
    } catch (cartError) {
      console.error('❌ Failed to clear cart:', cartError);
    }

    // Update stock
    for (const item of items) {
      try {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity }
        });
        console.log(`📦 Updated stock for product ${item.product}: -${item.quantity}`);
      } catch (stockError) {
        console.error(`❌ Failed to update stock for ${item.product}:`, stockError);
      }
    }

  } catch (error) {
    console.error('❌ Error creating order:', error);
  }
};

// Helper function for failed payment
const handleFailedPayment = async (paymentIntent) => {
  console.log('❌ Payment failed:', paymentIntent.id);
  // You can log failed payments or create a failed order record
  // Optional: Create a failed order record for analytics
  try {
    // You could create a failed order record here if needed
    console.log('📝 Failed payment recorded for analytics');
  } catch (error) {
    console.error('❌ Error handling failed payment:', error);
  }
};