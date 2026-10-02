const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authValidation = require('./auth.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');

// Public Authentication Endpoints
router.post('/register', validate(authValidation.registerInitiateSchema), authController.handleInitiateRegister);
router.post('/register/verify-otp', validate(authValidation.verifyRegisterOtpSchema), authController.handleVerifyRegisterOtp);
router.post('/register/resend-otp', validate(authValidation.resendRegisterOtpSchema), authController.handleResendRegisterOtp);
router.post('/login', validate(authValidation.loginSchema), authController.handleLogin);
router.post('/refresh-token', validate(authValidation.refreshTokenSchema), authController.handleRefreshToken);
router.post('/forgot-password', validate(authValidation.forgotPasswordSchema), authController.handleForgotPassword);
router.post('/verify-otp', validate(authValidation.verifyOtpSchema), authController.handleVerifyOTP);
router.post('/reset-password', validate(authValidation.resetPasswordSchema), authController.handleResetPassword);

// Protected Authentication Endpoints
router.post('/logout', authenticate, authController.handleLogout);
router.post('/change-password', authenticate, validate(authValidation.changePasswordSchema), authController.handleChangePassword);
router.get('/me', authenticate, authController.handleGetMe);

module.exports = router;
