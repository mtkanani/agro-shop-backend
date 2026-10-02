const { prisma } = require('../../config/database');
const { hashPassword, comparePassword } = require('../../utils/password');
const { generateAuthTokens, verifyRefreshToken, verifyAccessToken } = require('../../utils/jwt');
const { generateOTP } = require('../../utils/otp');
const { ROLE_PERMISSIONS } = require('../../middleware/role.middleware');
const env = require('../../config/env');

const { generateAndSaveOtp, verifyOtp: checkOtp } = require('../../services/otp.service');
const { sendOtpNotification } = require('../../services/notification.service');

function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || ['read'];
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  const maskedName = name.length > 2 ? `${name[0]}****${name[name.length - 1]}` : `${name[0]}****`;
  return `${maskedName}@${domain}`;
}

async function initiateRegistration(data) {
  const { shopName, fullName, ownerName, mobile, email, password, confirmPassword, address, villageCity, state, pincode } = data;

  if (confirmPassword && confirmPassword !== password) {
    const error = new Error('Password and confirm password do not match');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email ? email.trim().toLowerCase() : '';
  const normalizedMobile = mobile ? mobile.trim() : '';

  // 1. Check duplicate email in User
  if (normalizedEmail) {
    const existingUserEmail = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (existingUserEmail) {
      const error = new Error('This email is already registered. Please login instead.');
      error.statusCode = 409;
      throw error;
    }
  }

  // 2. Check duplicate mobile in User
  if (normalizedMobile) {
    const existingUserMobile = await prisma.user.findFirst({ where: { mobile: normalizedMobile } });
    if (existingUserMobile) {
      const error = new Error('This mobile number is already registered. Please login instead.');
      error.statusCode = 409;
      throw error;
    }
  }

  // 3. Check duplicate in Shop
  const existingShop = await prisma.shop.findFirst({
    where: {
      OR: [{ mobile: normalizedMobile }, { email: normalizedEmail }],
    },
  });

  if (existingShop) {
    const error = new Error(
      existingShop.email === normalizedEmail
        ? 'This email is already registered. Please login instead.'
        : 'This mobile number is already registered. Please login instead.'
    );
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await hashPassword(password);
  const identifier = normalizedEmail || normalizedMobile;

  const { rawOtp, expiresAt } = await generateAndSaveOtp({ identifier, purpose: 'REGISTRATION', expiryMinutes: 5 });

  await prisma.pendingRegistration.deleteMany({
    where: { OR: [{ email: normalizedEmail }, { mobile: normalizedMobile }] },
  });

  const pending = await prisma.pendingRegistration.create({
    data: {
      shopName,
      fullName,
      ownerName: ownerName || fullName,
      mobile: normalizedMobile,
      email: normalizedEmail,
      passwordHash: hashedPassword,
      address,
      villageCity,
      state,
      pincode,
      otp: rawOtp,
      expiresAt,
    },
  });

  await sendOtpNotification({ identifier, otp: rawOtp, purpose: 'REGISTRATION' });

  const responseData = {
    verificationId: pending.id,
    email: maskEmail(normalizedEmail),
    expiresIn: 300,
    otpLength: 6,
  };

  if (process.env.NODE_ENV !== 'production') {
    responseData.otp = rawOtp;
  }

  return {
    success: true,
    message: 'OTP sent successfully to your email',
    data: responseData,
  };
}

async function verifyRegistrationOTP(data) {
  const { verificationId, email, mobile, otp } = data;
  const identifier = email ? email.trim().toLowerCase() : (mobile ? mobile.trim() : null);

  const where = {};
  if (verificationId) {
    where.id = verificationId;
  } else if (identifier) {
    where.OR = [{ email: identifier }, { mobile: identifier }];
  } else {
    const error = new Error('Verification ID or Email/Mobile is required');
    error.statusCode = 400;
    throw error;
  }

  const pending = await prisma.pendingRegistration.findFirst({ where });

  if (!pending) {
    const error = new Error('Registration record not found or expired. Please start registration again.');
    error.statusCode = 404;
    throw error;
  }

  try {
    await checkOtp({ identifier: pending.email || pending.mobile, purpose: 'REGISTRATION', otp });
  } catch (err) {
    if (err.message && err.message.includes('attempts exceeded')) {
      const lockError = new Error('Too many incorrect attempts. Please request a new OTP.');
      lockError.statusCode = 429;
      lockError.code = 'OTP_ATTEMPTS_EXCEEDED';
      throw lockError;
    }
    const friendlyErr = new Error('Incorrect OTP. Please check the code and try again.');
    friendlyErr.statusCode = 400;
    friendlyErr.code = 'INVALID_OTP';
    throw friendlyErr;
  }

  const result = await prisma.$transaction(async (tx) => {
    const shopCount = await tx.shop.count();
    const shopCode = `SHOP-${String(shopCount + 1).padStart(4, '0')}`;

    const shop = await tx.shop.create({
      data: {
        shopName: pending.shopName,
        code: shopCode,
        ownerName: pending.ownerName,
        mobile: pending.mobile,
        email: pending.email,
        address: pending.address,
        villageCity: pending.villageCity,
        state: pending.state,
        pincode: pending.pincode,
        defaultLanguage: 'en',
        status: 'ACTIVE',
      },
    });

    const user = await tx.user.create({
      data: {
        shopId: shop.id,
        fullName: pending.fullName,
        email: pending.email,
        mobile: pending.mobile,
        passwordHash: pending.passwordHash,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    await tx.pendingRegistration.delete({
      where: { id: pending.id },
    });

    const tokens = generateAuthTokens(user);

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        shopId: user.shopId,
      },
      shop: {
        id: shop.id,
        shopName: shop.shopName,
        code: shop.code,
        status: shop.status,
      },
      tokens,
    };
  });

  return {
    success: true,
    message: 'Registration completed successfully',
    data: result,
  };
}

async function resendRegistrationOTP(data) {
  const { verificationId, email, mobile } = data;
  const identifier = email ? email.trim().toLowerCase() : (mobile ? mobile.trim() : null);

  const where = {};
  if (verificationId) {
    where.id = verificationId;
  } else if (identifier) {
    where.OR = [{ email: identifier }, { mobile: identifier }];
  } else {
    const error = new Error('Verification ID or Email/Mobile is required');
    error.statusCode = 400;
    throw error;
  }

  const pending = await prisma.pendingRegistration.findFirst({ where });

  if (!pending) {
    const error = new Error('Registration record not found or expired');
    error.statusCode = 404;
    throw error;
  }

  const otpIdentifier = pending.email || pending.mobile;
  const { rawOtp } = await generateAndSaveOtp({ identifier: otpIdentifier, purpose: 'REGISTRATION', expiryMinutes: 5 });

  await sendOtpNotification({ identifier: otpIdentifier, otp: rawOtp, purpose: 'REGISTRATION' });

  const responseData = {
    verificationId: pending.id,
    email: maskEmail(pending.email),
    expiresIn: 300,
    otpLength: 6,
  };

  if (process.env.NODE_ENV !== 'production') {
    responseData.otp = rawOtp;
  }

  return {
    success: true,
    message: 'A new OTP has been sent to your email',
    data: responseData,
  };
}

async function login(credentials) {
  const { identifier, email, mobile, password } = credentials;
  const targetIdentifier = identifier || email || mobile;

  if (!targetIdentifier) {
    const error = new Error('Email or mobile number is required for login');
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: targetIdentifier },
        { mobile: targetIdentifier },
      ],
    },
    include: {
      shop: true,
    },
  });

  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  if (user.status !== 'ACTIVE') {
    const error = new Error('User account is inactive');
    error.statusCode = 403;
    throw error;
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  if (!user.shop || user.shop.status !== 'ACTIVE') {
    const error = new Error('Associated shop account is inactive or suspended');
    error.statusCode = 403;
    throw error;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const tokens = generateAuthTokens(user);
  const permissions = getRolePermissions(user.role);

  return {
    user: {
      id: user.id,
      name: user.fullName,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      status: user.status,
    },
    shop: {
      id: user.shop.id,
      name: user.shop.shopName,
      shopName: user.shop.shopName,
      code: user.shop.code,
      defaultLanguage: user.shop.defaultLanguage || 'en',
      status: user.shop.status,
    },
    permissions,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

async function logout(userId, refreshToken) {
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }
  return { message: 'Logout successful' };
}

async function refreshTokens(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobile: true,
      role: true,
      shopId: true,
      status: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    const error = new Error('User inactive or not found');
    error.statusCode = 401;
    throw error;
  }

  const tokens = generateAuthTokens(user);
  return tokens;
}

async function forgotPassword({ email, mobile }) {
  const identifier = email || mobile;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { mobile: identifier }],
    },
  });

  if (!user) {
    const error = new Error('User account not found');
    error.statusCode = 404;
    throw error;
  }

  const crypto = require('crypto');
  const { rawOtp, expiresAt } = await generateAndSaveOtp({ identifier, purpose: 'FORGOT_PASSWORD', expiryMinutes: 15 });
  const resetToken = crypto.randomBytes(32).toString('hex');

  await prisma.passwordReset.deleteMany({
    where: { userId: user.id },
  });

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token: resetToken,
      otp: rawOtp,
      expiresAt,
    },
  });

  await sendOtpNotification({ identifier, otp: rawOtp, purpose: 'FORGOT_PASSWORD' });

  const response = {
    message: 'OTP sent for password reset. Please check your email or mobile.',
  };

  if (process.env.NODE_ENV !== 'production') {
    response.otp = rawOtp; // Exposed only in development for easy local testing
  }

  return response;
}

async function verifyOTP({ email, mobile, otp }) {
  const identifier = email || mobile;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { mobile: identifier }],
    },
  });

  if (!user) {
    const error = new Error('User account not found');
    error.statusCode = 404;
    throw error;
  }

  await checkOtp({ identifier: user.email || user.mobile, purpose: 'FORGOT_PASSWORD', otp });

  let resetRecord = await prisma.passwordReset.findFirst({
    where: { userId: user.id, isUsed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!resetRecord) {
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    resetRecord = await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
  }

  return {
    resetToken: resetRecord.token,
    message: 'OTP verified successfully. Use the reset token to set a new password.',
  };
}

async function resetPassword({ email, mobile, otp, newPassword }) {
  const identifier = email || mobile;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { mobile: identifier }],
    },
  });

  if (!user) {
    const error = new Error('User account not found');
    error.statusCode = 404;
    throw error;
  }

  const resetRecord = await prisma.passwordReset.findFirst({
    where: {
      userId: user.id,
      otp,
      isUsed: false,
    },
  });

  if (!resetRecord || new Date() > resetRecord.expiresAt) {
    const error = new Error('Invalid or expired OTP');
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    }),
    prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { isUsed: true },
    }),
  ]);

  return { message: 'Password reset successfully. You can now login with your new password.' };
}

async function changePassword(userId, { oldPassword, newPassword }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const isOldValid = await comparePassword(oldPassword, user.passwordHash);
  if (!isOldValid) {
    const error = new Error('Old password is incorrect');
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashedPassword },
  });

  return { message: 'Password changed successfully' };
}

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobile: true,
      role: true,
      status: true,
      shopId: true,
      shop: {
        select: {
          id: true,
          shopName: true,
          code: true,
          mobile: true,
          email: true,
          address: true,
          villageCity: true,
          state: true,
          pincode: true,
          defaultLanguage: true,
          status: true,
        },
      },
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const permissions = getRolePermissions(user.role);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      status: user.status,
    },
    shop: user.shop,
    role: user.role,
    permissions,
  };
}

module.exports = {
  initiateRegistration,
  verifyRegistrationOTP,
  resendRegistrationOTP,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  verifyOTP,
  resetPassword,
  changePassword,
  getProfile,
  getMe: getProfile,
};
