const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const User = require('../models/User');
const {
  register,
  login,
  logout,
  getMe,
  refreshToken,
  verifyEmail,
  verifyLoginCode,
  forgotPassword,
  resetPassword,
  resendVerification,
  verifyEmailWithCode  // This is imported from authController
} = require('../controllers/authController');

// ❌ REMOVE this entire function definition - it's duplicate and causing conflict
/*
const verifyEmailWithCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has a verification code
    if (!user.verificationCode || user.verificationCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Check if code is expired
    if (user.verificationCodeExpire < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired'
      });
    }

    // Verify user
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully!'
    });
  } catch (error) {
    next(error);
  }
};
*/

// Validation rules
const registerValidation = [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number')
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

const emailValidation = [
  body('email').isEmail().withMessage('Please provide a valid email')
];

const resetPasswordValidation = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const verifyLoginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits')
];

// Public routes
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/forgot-password', emailValidation, validate, forgotPassword);
router.post('/resend-verification', emailValidation, validate, resendVerification);
router.post('/verify-login', verifyLoginValidation, validate, verifyLoginCode);
router.get('/verify-email/:token', verifyEmail);
router.put('/reset-password/:token', resetPasswordValidation, validate, resetPassword);
router.post('/verify-email', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits')
], validate, verifyEmailWithCode);  // Now using the imported function

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.post('/refresh-token', protect, refreshToken);

module.exports = router;