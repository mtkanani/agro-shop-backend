/**
 * Generate numeric OTP of specified length (default 6 digits)
 */
function generateOTP(length = 6) {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10);
  }
  return otp;
}

/**
 * Check if OTP is expired given createdAt date and validity window in minutes
 */
function isOTPExpired(createdAt, validMinutes = 10) {
  const now = new Date();
  const diffInMs = now.getTime() - new Date(createdAt).getTime();
  const diffInMinutes = diffInMs / (1000 * 60);
  return diffInMinutes > validMinutes;
}

module.exports = {
  generateOTP,
  isOTPExpired,
};
