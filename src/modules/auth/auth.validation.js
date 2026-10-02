const Joi = require('joi');

const registerInitiateSchema = Joi.object({
  shopName: Joi.string().required().trim().min(2).max(100),
  fullName: Joi.string().required().trim().min(2).max(100),
  ownerName: Joi.string().optional().allow('', null).trim(),
  mobile: Joi.string().required().trim().min(10).max(15),
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().required().min(6).max(100),
  confirmPassword: Joi.string().valid(Joi.ref('password')).optional().messages({
    'any.only': 'Password and confirm password do not match',
  }),
  address: Joi.string().optional().allow('', null).trim(),
  villageCity: Joi.string().optional().allow('', null).trim(),
  state: Joi.string().optional().allow('', null).trim(),
  pincode: Joi.string().optional().allow('', null).trim(),
});

const verifyRegisterOtpSchema = Joi.object({
  verificationId: Joi.string().optional().allow('', null),
  email: Joi.string().email().optional().trim().lowercase(),
  mobile: Joi.string().optional().trim(),
  otp: Joi.string().required().length(6),
}).or('verificationId', 'email', 'mobile');

const resendRegisterOtpSchema = Joi.object({
  verificationId: Joi.string().optional().allow('', null),
  email: Joi.string().email().optional().trim().lowercase(),
  mobile: Joi.string().optional().trim(),
}).or('verificationId', 'email', 'mobile');

const loginSchema = Joi.object({
  identifier: Joi.string().optional().trim(),
  email: Joi.string().email().optional().trim().lowercase(),
  mobile: Joi.string().optional().trim(),
  password: Joi.string().required(),
}).or('identifier', 'email', 'mobile');

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().optional().trim().lowercase(),
  mobile: Joi.string().optional().trim(),
}).or('email', 'mobile');

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().optional().trim().lowercase(),
  mobile: Joi.string().optional().trim(),
  otp: Joi.string().required().length(6),
}).or('email', 'mobile');

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().optional().trim().lowercase(),
  mobile: Joi.string().optional().trim(),
  otp: Joi.string().required().length(6),
  newPassword: Joi.string().required().min(6).max(100),
}).or('email', 'mobile');

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().optional(),
  currentPassword: Joi.string().optional(),
  newPassword: Joi.string().required().min(6).max(100),
}).or('oldPassword', 'currentPassword');

module.exports = {
  registerInitiateSchema,
  verifyRegisterOtpSchema,
  resendRegisterOtpSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
};
