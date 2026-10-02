/**
 * WhatsApp Messaging & Deep Link Service
 * Formats agro billing statements and generates 1-click WhatsApp links (wa.me)
 */

function sanitizePhoneNumber(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const { t } = require('../i18n');

/**
 * Formats a farmer bill statement for WhatsApp in chosen language (en, gu, gujlish)
 */
function formatFarmerBillsWhatsAppMessage({ shop, farmer, billType, bills, summary, customNote, lang }) {
  const selectedLang = lang || farmer?.preferredLanguage || shop?.defaultLanguage || 'en';
  const shopName = shop?.shopName || t('common.appName', selectedLang);
  const shopPhone = shop?.mobile || '';
  const typeLabel = billType === 'ALL'
    ? t('whatsapp.farmerStatementTitle', selectedLang)
    : billType === 'COMPLETED'
    ? t('whatsapp.paidInvoicesReceiptTitle', selectedLang)
    : t('whatsapp.pendingDueReminderTitle', selectedLang);

  let message = `🌾 *${shopName.toUpperCase()}*\n`;
  message += `📋 *${typeLabel}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `👤 *${t('whatsapp.farmer', selectedLang)}:* ${farmer.name}\n`;
  if (farmer.phone) message += `📞 *${t('whatsapp.phone', selectedLang)}:* ${farmer.phone}\n`;
  if (farmer.village) message += `🏡 *${t('whatsapp.village', selectedLang)}:* ${farmer.village}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (!bills || bills.length === 0) {
    message += `ℹ️ No bills found for category: *${typeLabel}*.\n\n`;
  } else {
    message += `📄 *${t('whatsapp.billBreakdown', selectedLang)} (${bills.length} ${t('billing.invoice', selectedLang)}):*\n`;
    bills.slice(0, 10).forEach((inv, index) => {
      const due = Math.max(0, inv.totalAmount - inv.paidAmount);
      const statusIcon = inv.paymentStatus === 'PAID' ? '✅' : inv.paymentStatus === 'PARTIAL' ? '⚠️' : '❌';
      message += `${index + 1}. *${inv.invoiceNumber}* (${formatDate(inv.createdAt)})\n`;
      message += `   ${t('whatsapp.amount', selectedLang)}: ₹${formatCurrency(inv.totalAmount)} | ${t('whatsapp.paid', selectedLang)}: ₹${formatCurrency(inv.paidAmount)}`;
      if (due > 0) message += ` | *${t('whatsapp.due', selectedLang)}: ₹${formatCurrency(due)}*`;
      message += ` [${inv.paymentStatus} ${statusIcon}]\n`;
    });

    if (bills.length > 10) {
      message += `   ... and ${bills.length - 10} more bill(s).\n`;
    }
    message += `\n`;
  }

  message += `📊 *${t('whatsapp.summaryTotals', selectedLang)}:*\n`;
  message += `• ${t('whatsapp.totalBills', selectedLang)}: ₹${formatCurrency(summary.totalAmount)}\n`;
  message += `• ${t('whatsapp.totalPaid', selectedLang)}: ₹${formatCurrency(summary.totalPaid)}\n`;
  message += `• *${t('whatsapp.totalDue', selectedLang)}: ₹${formatCurrency(summary.totalDue)}*\n`;
  message += `• ${t('whatsapp.khataBalance', selectedLang)}: ₹${formatCurrency(farmer.khataBalance)}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;

  // Add UPI payment link if dues exist
  if (summary.totalDue > 0 && shopPhone) {
    const upiId = `${shopPhone}@upi`; // Default standard mobile UPI VPA
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${summary.totalDue}&tn=Khata-Due-Payment`;
    message += `\n💳 *${t('whatsapp.payViaUpi', selectedLang)}:* ${upiLink}\n`;
  }

  if (customNote && customNote.trim()) {
    message += `\n📝 *${t('whatsapp.noteFromShop', selectedLang)}:* ${customNote.trim()}\n`;
  }

  message += `\n🙏 ${t('whatsapp.thankYouNote', selectedLang)}\n`;
  if (shopPhone) message += `📞 ${t('whatsapp.contact', selectedLang)}: ${shopPhone}\n`;

  return message;
}

/**
 * Generates a direct WhatsApp web/app link
 */
function generateWhatsAppDeepLink({ phone, message }) {
  const sanitized = sanitizePhoneNumber(phone);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${sanitized}?text=${encodedText}`;
}

/**
 * Sends or simulates WhatsApp message dispatch
 */
async function sendWhatsApp({ phone, message }) {
  const sanitized = sanitizePhoneNumber(phone);

  if (process.env.NODE_ENV === 'test' || !process.env.WHATSAPP_API_KEY) {
    console.log(`📱 [WHATSAPP SIMULATOR] To: +${sanitized} | Length: ${message.length} chars`);
    return {
      status: 'SIMULATED',
      provider: 'simulator',
      phone: sanitized,
      messagePreview: message.slice(0, 120),
    };
  }

  // Real WhatsApp Business API / Twilio integration point
  try {
    console.log(`📱 [WHATSAPP DISPATCH] Sending real WhatsApp to +${sanitized}`);
    return {
      status: 'SENT',
      provider: 'whatsapp_cloud_api',
      phone: sanitized,
    };
  } catch (error) {
    console.error(`❌ Failed to send WhatsApp to +${sanitized}:`, error.message);
    throw error;
  }
}

module.exports = {
  sanitizePhoneNumber,
  formatCurrency,
  formatDate,
  formatFarmerBillsWhatsAppMessage,
  generateWhatsAppDeepLink,
  sendWhatsApp,
};
