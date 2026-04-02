import { body, validationResult } from 'express-validator';

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

export const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('fullName').trim().isLength({ min: 2, max: 100 }),
  body('phone').optional().isMobilePhone(),
  validateRequest
];

export const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validateRequest
];

export const validateWalletTopup = [
  body('amount')
    .isInt({ min: 1000, max: 100000 }) // R10 to R1000 in cents
    .withMessage('Amount must be between R10 and R1000'),
  validateRequest
];

export const validateTicketPurchase = [
  body('routeId').isInt({ min: 1 }),
  body('fareType').isIn(['adult', 'student', 'senior', 'child']),
  body('quantity').isInt({ min: 1, max: 10 }),
  validateRequest
];

export const validatePasswordChange = [
  body('currentPassword').notEmpty(),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  validateRequest
];

export const validateProfileUpdate = [
  body('fullName').optional().trim().isLength({ min: 2, max: 100 }),
  body('phone').optional().isMobilePhone(),
  validateRequest
];