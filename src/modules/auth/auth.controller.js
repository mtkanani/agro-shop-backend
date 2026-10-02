const authService = require('./auth.service');
const { successResponse } = require('../../utils/response');

async function handleInitiateRegister(req, res, next) {
  try {
    const result = await authService.initiateRegistration(req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function handleVerifyRegisterOtp(req, res, next) {
  try {
    const result = await authService.verifyRegistrationOTP(req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function handleResendRegisterOtp(req, res, next) {
  try {
    const result = await authService.resendRegistrationOTP(req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function handleLogin(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return successResponse(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
}

async function handleLogout(req, res, next) {
  try {
    const refreshToken = req.body?.refreshToken;
    const result = await authService.logout(req.user?.id, refreshToken);
    return successResponse(res, result, 'Logout successful');
  } catch (error) {
    next(error);
  }
}

async function handleRefreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshTokens(refreshToken);
    return successResponse(res, tokens, 'Tokens refreshed successfully');
  } catch (error) {
    next(error);
  }
}

async function handleForgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.body);
    return successResponse(res, result, 'Password reset OTP generated');
  } catch (error) {
    next(error);
  }
}

async function handleVerifyOTP(req, res, next) {
  try {
    const result = await authService.verifyOTP(req.body);
    return successResponse(res, result, 'OTP verified successfully');
  } catch (error) {
    next(error);
  }
}

async function handleResetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.body);
    return successResponse(res, result, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
}

async function handleChangePassword(req, res, next) {
  try {
    const result = await authService.changePassword(req.user.id, req.body);
    return successResponse(res, result, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    return successResponse(res, user, 'User profile fetched');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleInitiateRegister,
  handleVerifyRegisterOtp,
  handleResendRegisterOtp,
  handleLogin,
  handleLogout,
  handleRefreshToken,
  handleForgotPassword,
  handleVerifyOTP,
  handleResetPassword,
  handleChangePassword,
  handleGetMe,
};
