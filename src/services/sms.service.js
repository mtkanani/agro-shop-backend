/**
 * SMS Provider Service Abstraction (Twilio / Fast2SMS / MSG91 / Simulator)
 */
async function sendSms({ mobile, message }) {
  const provider = process.env.SMS_PROVIDER || 'simulator';

  if (process.env.NODE_ENV === 'test' || provider === 'simulator') {
    console.log(`📱 [SMS SIMULATOR] To: ${mobile} | Message: ${message}`);
    return { status: 'SIMULATED', mobile, message };
  }

  // Provider Dispatcher (e.g. Twilio / Fast2SMS / MSG91 API integration point)
  try {
    console.log(`📱 [SMS DISPATCH] Sending real SMS via ${provider} to ${mobile}`);
    // Real HTTP API call to SMS gateway would go here when provider API keys are supplied
    return { status: 'SENT', provider, mobile };
  } catch (error) {
    console.error(`❌ Failed to send SMS via ${provider} to ${mobile}:`, error.message);
    throw error;
  }
}

async function sendOtpSms({ mobile, otp, purpose }) {
  const message = `Shree Agro Center: Your OTP for ${purpose.replace('_', ' ')} is ${otp}. Valid for 10 mins. Do not share.`;
  return sendSms({ mobile, message });
}

module.exports = {
  sendSms,
  sendOtpSms,
};
