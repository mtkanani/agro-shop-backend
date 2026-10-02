const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');

/**
 * Generate a 6-digit numerical OTP, hash it, and persist to database.
 */
async function generateAndSaveOtp({ identifier, purpose, expiryMinutes = 10 }) {
  // Generate 6-digit random code
  const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await bcrypt.hash(rawOtp, 10);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Invalidate any active previous unverified OTPs for this identifier & purpose
  await prisma.otp.updateMany({
    where: {
      identifier,
      purpose,
      isVerified: false,
    },
    data: {
      isVerified: false,
      expiresAt: new Date(),
    },
  });

  // Create new OTP record
  await prisma.otp.create({
    data: {
      identifier,
      purpose,
      otpHash,
      expiresAt,
      isVerified: false,
    },
  });

  return { rawOtp, expiresAt };
}

/**
 * Verify OTP string against database hash for a given identifier & purpose.
 */
async function verifyOtp({ identifier, purpose, otp }) {
  const activeOtpRecord = await prisma.otp.findFirst({
    where: {
      identifier,
      purpose,
      isVerified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!activeOtpRecord) {
    const err = new Error('Invalid or expired OTP code');
    err.statusCode = 400;
    throw err;
  }

  if (activeOtpRecord.attempts >= 5) {
    const err = new Error('Maximum OTP verification attempts exceeded. Please request a new OTP');
    err.statusCode = 429;
    throw err;
  }

  const isMatch = await bcrypt.compare(String(otp), activeOtpRecord.otpHash);

  if (!isMatch) {
    await prisma.otp.update({
      where: { id: activeOtpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    const err = new Error('Incorrect OTP code provided');
    err.statusCode = 400;
    throw err;
  }

  // Mark OTP as verified
  const verifiedRecord = await prisma.otp.update({
    where: { id: activeOtpRecord.id },
    data: {
      isVerified: true,
      verifiedAt: new Date(),
    },
  });

  return verifiedRecord;
}

module.exports = {
  generateAndSaveOtp,
  verifyOtp,
};
