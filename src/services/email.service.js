const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  if (process.env.NODE_ENV === 'test' || !process.env.SMTP_USER) {
    console.log(`📧 [EMAIL SIMULATOR] To: ${to} | Subject: ${subject}`);
    return { messageId: 'simulated-msg-id' };
  }

  try {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM || '"Shree Agro Center" <no-reply@agro.com>',
      to,
      subject,
      text,
      html,
    });
    console.log(`📧 Email sent successfully to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    throw error;
  }
}

const { t } = require('../i18n');

async function sendOtpEmail({ to, otp, purpose, lang = 'en' }) {
  const appName = t('common.appName', lang);
  const subject = t('email.otpSubject', lang, { appName });
  const greeting = t('email.otpGreeting', lang);
  const instruction = t('email.otpInstruction', lang, { purpose: purpose.replace('_', ' ') });
  const expiry = t('email.otpExpiry', lang);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2e7d32; text-align: center;">🌾 ${appName}</h2>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p>${greeting}</p>
      <p>${instruction}</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1b5e20; background: #e8f5e9; padding: 10px 20px; border-radius: 6px; border: 1px dashed #4caf50;">
          ${otp}
        </span>
      </div>
      <p style="color: #666; font-size: 13px;">${expiry}</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
      <p style="font-size: 11px; color: #999; text-align: center;">© 2026 ${appName} Management Software</p>
    </div>
  `;

  return sendEmail({ to, subject, html, text: `Your OTP is ${otp}` });
}

async function sendFarmerBillsEmail({ to, shop, farmer, billType, bills, summary, customNote, lang }) {
  const selectedLang = lang || farmer?.preferredLanguage || shop?.defaultLanguage || 'en';
  const shopName = shop?.shopName || t('common.appName', selectedLang);
  const shopPhone = shop?.mobile || '';
  const shopAddress = [shop?.address, shop?.villageCity, shop?.state].filter(Boolean).join(', ');
  const gstin = shop?.gstin ? `GSTIN: ${shop.gstin}` : '';

  const typeTitle = billType === 'ALL'
    ? t('whatsapp.farmerStatementTitle', selectedLang)
    : billType === 'COMPLETED'
    ? t('billing.paidAmount', selectedLang)
    : t('whatsapp.reminderTitle', selectedLang);

  const typeColor = billType === 'COMPLETED' ? '#16a34a' : billType === 'PENDING' ? '#ea580c' : '#2563eb';
  const typeBg = billType === 'COMPLETED' ? '#f0fdf4' : billType === 'PENDING' ? '#fff7ed' : '#eff6ff';

  const formatCurr = (val) => Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatDateStr = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const subject = `${shopName} - ${typeTitle} for ${farmer.name}`;

  const billRowsHtml = (bills || []).map((inv, idx) => {
    const due = Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
    const statusBg = inv.paymentStatus === 'PAID' ? '#dcfce7' : inv.paymentStatus === 'PARTIAL' ? '#fef3c7' : '#fee2e2';
    const statusText = inv.paymentStatus === 'PAID' ? '#15803d' : inv.paymentStatus === 'PARTIAL' ? '#b45309' : '#b91c1c';
    const itemsCount = inv.items ? `${inv.items.length} item(s)` : '-';

    return `
      <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 1 ? 'background-color: #fafafa;' : ''}">
        <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${inv.invoiceNumber}</td>
        <td style="padding: 10px 12px; color: #64748b;">${formatDateStr(inv.createdAt)}</td>
        <td style="padding: 10px 12px; color: #64748b;">${itemsCount}</td>
        <td style="padding: 10px 12px; text-align: right; color: #0f172a;">₹${formatCurr(inv.totalAmount)}</td>
        <td style="padding: 10px 12px; text-align: right; color: #16a34a;">₹${formatCurr(inv.paidAmount)}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 600; color: ${due > 0 ? '#dc2626' : '#64748b'};">₹${formatCurr(due)}</td>
        <td style="padding: 10px 12px; text-align: center;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: ${statusBg}; color: ${statusText};">
            ${inv.paymentStatus}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const upiSection = summary.totalDue > 0 && shopPhone ? `
    <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #1e293b;">💳 Quick Payment via UPI</p>
      <p style="margin: 0; font-size: 13px; color: #475569;">
        Pay using GPay, PhonePe, Paytm, or BHIM: <strong style="color: #0f172a;">${shopPhone}@upi</strong>
      </p>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Amount Due: <strong>₹${formatCurr(summary.totalDue)}</strong></p>
    </div>
  ` : '';

  const noteSection = customNote && customNote.trim() ? `
    <div style="margin-top: 16px; padding: 12px 16px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #1e40af;"><strong>Note from Shop:</strong> ${customNote.trim()}</p>
    </div>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px;">
      <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #166534 0%, #15803d 100%); color: #ffffff; padding: 24px 28px;">
          <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">🌾 ${shopName}</h1>
          <p style="margin: 0; font-size: 13px; opacity: 0.9;">${shopAddress || 'Agricultural Products & Fertilizers'}</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.85;">Phone: ${shopPhone} ${gstin ? `| ${gstin}` : ''}</p>
        </div>

        <div style="padding: 24px 28px;">
          <!-- Title & Date -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
            <div>
              <span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; background-color: ${typeBg}; color: ${typeColor}; border: 1px solid ${typeColor}33;">
                ${typeTitle.toUpperCase()}
              </span>
            </div>
            <div style="text-align: right; font-size: 12px; color: #64748b;">
              Generated: <strong>${formatDateStr(new Date())}</strong>
            </div>
          </div>

          <!-- Farmer Info -->
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Farmer Details</p>
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">${farmer.name}</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">
              ${farmer.phone ? `Phone: ${farmer.phone}` : ''} 
              ${farmer.village ? `| Village: ${farmer.village}` : ''}
              ${farmer.khataBalance ? `| Overall Khata Balance: ₹${formatCurr(farmer.khataBalance)}` : ''}
            </p>
          </div>

          <!-- Summary Metric Cards -->
          <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 20px;">
            <tr>
              <td style="background-color: #f1f5f9; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Bills</div>
                <div style="font-size: 18px; font-weight: 700; color: #1e293b; margin-top: 4px;">${summary.count || 0}</div>
              </td>
              <td style="background-color: #f1f5f9; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Amount</div>
                <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">₹${formatCurr(summary.totalAmount)}</div>
              </td>
              <td style="background-color: #f0fdf4; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 11px; color: #16a34a; font-weight: 600; text-transform: uppercase;">Total Paid</div>
                <div style="font-size: 18px; font-weight: 700; color: #15803d; margin-top: 4px;">₹${formatCurr(summary.totalPaid)}</div>
              </td>
              <td style="background-color: ${summary.totalDue > 0 ? '#fef2f2' : '#f1f5f9'}; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 11px; color: ${summary.totalDue > 0 ? '#dc2626' : '#64748b'}; font-weight: 600; text-transform: uppercase;">Total Due</div>
                <div style="font-size: 18px; font-weight: 700; color: ${summary.totalDue > 0 ? '#b91c1c' : '#1e293b'}; margin-top: 4px;">₹${formatCurr(summary.totalDue)}</div>
              </td>
            </tr>
          </table>

          ${noteSection}

          <!-- Invoices Table -->
          <div style="margin-top: 20px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                  <th style="padding: 10px 12px;">Invoice #</th>
                  <th style="padding: 10px 12px;">Date</th>
                  <th style="padding: 10px 12px;">Items</th>
                  <th style="padding: 10px 12px; text-align: right;">Total</th>
                  <th style="padding: 10px 12px; text-align: right;">Paid</th>
                  <th style="padding: 10px 12px; text-align: right;">Due</th>
                  <th style="padding: 10px 12px; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${billRowsHtml || '<tr><td colspan="7" style="padding: 24px; text-align: center; color: #94a3b8;">No invoices found for this criteria.</td></tr>'}
              </tbody>
            </table>
          </div>

          ${upiSection}

          <!-- Footer -->
          <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0 0 4px 0;">Thank you for your valued partnership with <strong>${shopName}</strong>.</p>
            <p style="margin: 0; font-size: 11px;">Powered by Shree Agro Billing & Khata Management System</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `${shopName}\n${typeTitle}\nFarmer: ${farmer.name}\nTotal Amount: ₹${formatCurr(summary.totalAmount)}\nTotal Due: ₹${formatCurr(summary.totalDue)}`;

  return sendEmail({ to, subject, html, text });
}

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendFarmerBillsEmail,
};
