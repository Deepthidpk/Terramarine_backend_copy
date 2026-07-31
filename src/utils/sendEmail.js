const nodemailer = require('nodemailer');
const path = require('path');
const dotenv = require('dotenv');

/**
 * Send an email via configured SMTP (Gmail / Custom) or fallback to Ethereal test email.
 * @param {Object} options - { to, subject, html, text }
 * @returns {Promise<{ success: boolean, info: object, testUrl?: string }>}
 */
const sendEmail = async ({ to, subject, html, text }) => {
  // Always load latest .env values with override: true so long-running servers pick up credentials immediately
  dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER || 'terramarine33@gmail.com';
  const senderEmail = process.env.SMTP_FROM || smtpUser;
  let smtpPass = process.env.SMTP_PASS;

  console.log(`[sendEmail] Initiating dispatch to: ${to}`);
  console.log(`[sendEmail] Sender: ${senderEmail}, Host: ${smtpHost}:${smtpPort}`);

  // 1. If App Password is configured and not default placeholder, send via Gmail / Custom SMTP
  if (smtpPass && smtpPass !== 'your_gmail_app_password' && smtpPass.trim() !== '') {
    try {
      // Remove any extra whitespace from Gmail app password if present
      const cleanPass = smtpPass.trim();

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: cleanPass,
        },
        tls: { rejectUnauthorized: false }
      });

      const info = await transporter.sendMail({
        from: `"TerraMarine Support" <${senderEmail}>`,
        to,
        subject,
        text: text || (html ? html.replace(/<[^>]+>/g, '') : ''),
        html,
      });

      console.log(`[SMTP SUCCESS] Email delivered to ${to} (Message ID: ${info.messageId})`);
      return { success: true, info };
    } catch (err) {
      console.error('[SMTP ERROR] Failed to send via Gmail SMTP:', err.message);
      // Fall back to Ethereal if real Gmail dispatch encounters an error
    }
  } else {
    console.warn('[SMTP WARNING] SMTP_PASS is missing or set to default placeholder.');
  }

  // 2. Fallback to Ethereal Test Mailer if real SMTP fails or is unconfigured
  try {
    console.log('[SMTP FALLBACK] Attempting dispatch via Ethereal test server...');
    const testAccount = await nodemailer.createTestAccount();
    const testTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await testTransporter.sendMail({
      from: `"TerraMarine Support" <${senderEmail}>`,
      to,
      subject,
      text: text || (html ? html.replace(/<[^>]+>/g, '') : ''),
      html,
    });

    const testUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[TEST EMAIL SENT] View message in browser: ${testUrl}`);
    return { success: true, info, testUrl };
  } catch (fallbackErr) {
    console.error('[TEST MAILER ERROR]:', fallbackErr.message);
    throw fallbackErr;
  }
};

module.exports = sendEmail;
