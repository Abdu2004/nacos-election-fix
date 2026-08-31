const nodemailer = require('nodemailer');
const config = require('../config/env');
const AppError = require('../utils/AppError');

let transporter = null;

/**
 * Initialize and get Nodemailer transporter
 */
async function getTransporter() {
  if (transporter) return transporter;

  if (config.env === 'test') {
    // In automated tests, mock transporter that records sent messages
    transporter = {
      sendMail: async (mailOptions) => {
        if (config.env === 'development') {
          console.log(`[Email Service Mock] Sending email to: ${mailOptions.to}, Subject: ${mailOptions.subject}`);
        }
        return { messageId: `mock-${Date.now()}` };
      }
    };
    return transporter;
  }

  // Real or Ethereal SMTP transporter
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: (config.smtp.user && config.smtp.pass) ? {
      user: config.smtp.user,
      pass: config.smtp.pass
    } : undefined
  });

  return transporter;
}

/**
 * Send an OTP Authentication email
 * @param {string} toEmail - Recipient Gmail
 * @param {string} otp - 6-digit OTP code (NEVER log this!)
 * @param {string} [name='Student'] - Recipient Name
 * @param {number} [expiryMinutes=10] - OTP expiration in minutes
 */
async function sendOTPEmail(toEmail, otp, name = 'Student', expiryMinutes = 10, purpose = 'AUTHENTICATION') {
  const mailClient = await getTransporter();

  const isVoting = purpose === 'VOTING';
  const isReset = purpose === 'PASSWORD_RESET';

  let subject = 'Your NACOS Election Login OTP Code';
  let purposeText = 'one-time authentication code';

  if (isVoting) {
    subject = 'Your Ballot Confirmation Code (OTP) - NACOS Election FUBK';
    purposeText = 'one-time ballot confirmation code to securely cast your vote';
  } else if (isReset) {
    subject = 'Your Password Reset OTP Code - NACOS Election FUBK';
    purposeText = 'password reset verification code';
  }

  const mailOptions = {
    from: config.smtp.from,
    to: toEmail,
    subject,
    text: `Hello ${name},\n\nYour ${purposeText} for the NACOS Election Management System (FUBK Chapter) is: ${otp}\n\nThis code will expire in ${expiryMinutes} minutes. Do NOT share this code with anyone.\n\nIf you did not initiate this action, please contact election administrators immediately.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0;">NACOS ELECTION MANAGEMENT SYSTEM</h2>
          <p style="color: #16a34a; font-weight: bold; font-size: 13px; margin-top: 2px;">FUBK CHAPTER</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">${isVoting ? 'Official 2FA Ballot Submission Confirmation' : isReset ? 'Account Security & Password Reset' : 'Official Voting & Identity Verification Portal'}</p>
        </div>
        <p style="color: #334155; font-size: 15px;">Hello <strong>${name}</strong>,</p>
        <p style="color: #334155; font-size: 15px;">Your ${purposeText} is:</p>
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #16a34a;">${otp}</span>
        </div>
        <p style="color: #475569; font-size: 14px;">This code will expire in <strong>${expiryMinutes} minutes</strong>. For election integrity and security, never share this code with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Technology Towards Advancement &bull; NACOS FUBK Chapter</p>
      </div>
    `
  };

  try {
    const info = await mailClient.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email Error] Failed to send email to ${toEmail}:`, error.message);
    if (error.code === 'EAUTH' || (error.response && error.response.includes('535')) || error.message.includes('535')) {
      throw new AppError(
        'Email delivery authentication failed (535). If using Gmail, you must generate a 16-character Google App Password (not your normal Gmail password) and set it as SMTP_PASS in backend/.env.',
        500,
        'EMAIL_AUTH_FAILED'
      );
    }
    throw new AppError(
      `Email delivery service encountered an issue: ${error.message}`,
      500,
      'EMAIL_DISPATCH_FAILED'
    );
  }
}

module.exports = {
  sendOTPEmail,
  getTransporter
};
