const { sendOtpEmail } = require('./email.service');
const { sendOtpSms } = require('./sms.service');

/**
 * Dispatch OTP notification via Email or SMS depending on the identifier type.
 */
async function sendOtpNotification({ identifier, otp, purpose }) {
  const isEmail = identifier.includes('@');

  if (isEmail) {
    return sendOtpEmail({ to: identifier, otp, purpose });
  } else {
    return sendOtpSms({ mobile: identifier, otp, purpose });
  }
}

module.exports = {
  sendOtpNotification,
};
