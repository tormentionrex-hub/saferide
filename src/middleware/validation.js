const { validationResult } = require('express-validator');
// Middleware to handle validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  // If there are validation errors, return 400 with details
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  
  next();
};

module.exports = validate;