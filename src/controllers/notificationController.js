const { Notification } = require('../models');

// @desc    Get user notifications
// @route   GET /api/v1/notifications
// @access  Private

//Function to get user notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = { user_id: req.user._id };

    if (status) query.status = status;
    // Fetch notifications with pagination
    const notifications = await Notification.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1 });
    // Get total count for pagination
    const count = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      user_id: req.user._id,
      status: 'unread',
    });

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/v1/notifications/:id/read
// @access  Private

//Function to mark notification as read
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Check if user owns the notification
    if (notification.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Update status
    notification.status = 'read';
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/v1/notifications/read-all
// @access  Private

//Function to mark all notifications as read
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user_id: req.user._id, status: 'unread' },
      { status: 'read' }
    );
    // Respond successfully
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete notification
// @route   DELETE /api/v1/notifications/:id
// @access  Private

//Function to delete notification
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Check if user owns the notification
    if (notification.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Delete notification
    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create notification (System/Admin)
// @route   POST /api/v1/notifications
// @access  Private/Admin

//Function to create notification
exports.createNotification = async (req, res, next) => {
  try {
    const { user_id, message, type, relatedEntity } = req.body;
    // Create notification
    const notification = await Notification.create({
      user_id,
      message,
      type,
      relatedEntity,
    });
    // Respond successfully
    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};