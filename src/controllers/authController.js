const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { 
  sendVerificationEmail, 
  sendPasswordResetEmail,
  sendLoginVerificationCode 
} = require('../services/emailService');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    console.log('getMe - req.user:', req.user); // DEBUG
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found in request'
      });
    }

    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('getMe error:', error); // DEBUG
    next(error);
  }
};
// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Private
const refreshToken = async (req, res, next) => {
  try {
    const token = generateToken(req.user._id);
    res.json({
      success: true,
      data: { token }
    });
  } catch (error) {
    next(error);
  }
};

// Generate verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Get device info from request
const getDeviceInfo = (req) => {
  return {
    userAgent: req.headers['user-agent'] || 'Unknown',
    ip: req.ip || req.connection.remoteAddress,
    deviceId: crypto.createHash('md5').update(req.headers['user-agent'] || '').digest('hex')
  };
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user (unverified)
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      isVerified: false
    });

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.verificationCode = verificationCode;
    user.verificationCodeExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send verification email with code
    await sendVerificationEmail(user.email, verificationCode, user.firstName);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email for verification code.',
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Verify user
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully! You can now login.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user with security checks
// @route   POST /api/auth/login
// @access  Public
// @desc    Login user with security checks
// @route   POST /api/auth/login
// @access  Public
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked && user.isLocked()) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(401).json({
        success: false,
        message: `Account locked. Try again in ${lockTime} minutes`
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      if (user.incLoginAttempts) await user.incLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful password match
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    // Check if email is verified - THIS IS THE ONLY VERIFICATION NEEDED
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        emailNotVerified: true,
        message: 'Please verify your email first'
      });
    }

    // REMOVE THE IP-BASED VERIFICATION CODE - We don't need this anymore
    // Just update last login info and generate token directly

    // Update last login info
    user.lastLoginIp = clientIp;
    user.lastLoginDevice = userAgent;
    user.lastLoginAt = new Date();
    
    // Optional: Still track known IPs for analytics (not for verification)
    if (!user.knownIps) {
      user.knownIps = [];
    }

    const existingIp = user.knownIps.find(ip => ip.address === clientIp);
    if (!existingIp) {
      user.knownIps.push({
        address: clientIp,
        userAgent: userAgent,
        firstSeen: new Date(),
        lastUsed: new Date()
      });
    } else {
      existingIp.lastUsed = new Date();
    }
    
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Verify login code
// @route   POST /api/auth/verify-login
// @access  Public
// @desc    Verify login code for new IP
// @route   POST /api/auth/verify-login
// @access  Public
const verifyLoginCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if code is valid
    if (user.loginVerificationCode !== code || 
        user.loginVerificationCodeExpire < Date.now()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Add IP to known IPs
    if (!user.knownIps) {
      user.knownIps = [];
    }

    const existingIp = user.knownIps.find(ip => ip.address === clientIp);

    if (!existingIp) {
      user.knownIps.push({
        address: clientIp,
        userAgent: userAgent,
        firstSeen: new Date(),
        lastUsed: new Date()
      });
    } else {
      existingIp.lastUsed = new Date();
    }

    // Clear verification code
    user.loginVerificationCode = undefined;
    user.loginVerificationCodeExpire = undefined;
    user.pendingLoginIp = undefined;
    user.pendingLoginUserAgent = undefined;

    // Update last login
    user.lastLoginIp = clientIp;
    user.lastLoginDevice = userAgent;
    user.lastLoginAt = new Date();
    
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordTokenExpire = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send email
    await sendPasswordResetEmail(user.email, resetToken, user.firstName);

    res.json({
      success: true,
      message: 'Password reset email sent'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful. You can now login.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
// @desc    Resend verification email with code
// @route   POST /api/auth/resend-verification
// @access  Public
// @desc    Verify email with code
// @route   POST /api/auth/verify-email
// @access  Public
// In authController.js - add this function if it doesn't exist
// @desc    Verify email with code
// @route   POST /api/auth/verify-email
// @access  Public
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

const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.verificationCode = verificationCode;
    user.verificationCodeExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send email with code
    await sendVerificationEmail(user.email, verificationCode, user.firstName);

    res.json({
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  register,
  login,
  verifyEmail,
  verifyLoginCode,
  forgotPassword,
  resetPassword,
  resendVerification,
  logout,
  getMe,
  refreshToken,
    verifyEmail,        // Keep the old one (token-based)
  verifyEmailWithCode
};