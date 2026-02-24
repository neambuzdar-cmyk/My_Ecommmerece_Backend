    
  const User = require('../models/User');
  const bcrypt = require('bcryptjs');

  // @desc    Get user profile
  // @route   GET /api/users/profile
  // @access  Private
  const getProfile = async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id)
        .select('-password')
        .populate('wishlist', 'name price images');
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  };

  // @desc    Update profile
  // @route   PUT /api/users/profile
  // @access  Private
  const updateProfile = async (req, res, next) => {
    try {
      const { firstName, lastName, phone, avatar } = req.body;
      
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { firstName, lastName, phone, avatar },
        { new: true, runValidators: true }
      ).select('-password');

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  };

  // @desc    Add address
  // @route   POST /api/users/address
  // @access  Private
  const addAddress = async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);
      
      // If isDefault is true, set all other addresses to false
      if (req.body.isDefault) {
        user.addresses.forEach(addr => addr.isDefault = false);
      }

      user.addresses.push(req.body);
      await user.save();

      res.status(201).json({
        success: true,
        data: user.addresses
      });
    } catch (error) {
      next(error);
    }
  };

  // @desc    Update address
  // @route   PUT /api/users/address/:id
  // @access  Private
  const updateAddress = async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);
      const address = user.addresses.id(req.params.id);

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      // If setting as default, update other addresses
      if (req.body.isDefault && !address.isDefault) {
        user.addresses.forEach(addr => addr.isDefault = false);
      }

      Object.assign(address, req.body);
      await user.save();

      res.json({
        success: true,
        data: user.addresses
      });
    } catch (error) {
      next(error);
    }
  };

  // @desc    Delete address
  // @route   DELETE /api/users/address/:id
  // @access  Private
  const deleteAddress = async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);
      user.addresses.id(req.params.id).remove();
      await user.save();

      res.json({
        success: true,
        data: user.addresses
      });
    } catch (error) {
      next(error);
    }
  };

  // @desc    Change password
  // @route   POST /api/users/change-password
  // @access  Private
  const changePassword = async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user._id).select('+password');

      // Check current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  module.exports = {
    getProfile,
    updateProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    changePassword
  };