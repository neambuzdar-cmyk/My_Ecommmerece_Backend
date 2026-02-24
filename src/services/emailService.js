const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ SMTP Error:', error);
  } else {
    console.log('✅ SMTP Server is ready');
  }
});

// Send verification email with 6-digit code
const sendVerificationEmail = async (email, code, name) => {
  const mailOptions = {
    from: `"LUXEMART Security" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify Your Email Address',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #000 0%, #1a1a1a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code { background: #000; color: #fff; font-size: 36px; font-weight: bold; padding: 20px; text-align: center; letter-spacing: 10px; border-radius: 8px; margin: 30px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .brand { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .brand span { color: #d4af37; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">LUXE<span>MART</span></div>
            <p>Premium Shopping Destination</p>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">Hello ${name},</h2>
            <p>Thank you for registering with LUXEMART! Please verify your email address using the 6-digit code below:</p>
            
            <div class="code">${code}</div>
            
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            
            <p>If you didn't create an account with LUXEMART, please ignore this email.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #666;">
              For security reasons, never share this code with anyone.<br>
              Our team will never ask for your password or verification code.
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} LUXEMART. All rights reserved.</p>
            <p>Secure 256-bit SSL Encrypted</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  return await transporter.sendMail(mailOptions);
};

// Send password reset email
const sendPasswordResetEmail = async (email, token, name) => {
  const resetUrl = `http://localhost:3000/reset-password/${token}`;
  
  const mailOptions = {
    from: `"LUXEMART Security" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #000 0%, #1a1a1a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #000; color: white; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .brand { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .brand span { color: #d4af37; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">LUXE<span>MART</span></div>
            <p>Premium Shopping Destination</p>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">Hello ${name},</h2>
            <p>You requested to reset your password. Click the button below to proceed:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy this link to your browser:</p>
            <p style="background: #eee; padding: 10px; border-radius: 5px; word-break: break-all;">${resetUrl}</p>
            
            <p>This link will expire in <strong>1 hour</strong>.</p>
            
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} LUXEMART. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  return await transporter.sendMail(mailOptions);
};

// Send login verification code (for new IP)
const sendLoginVerificationCode = async (email, code, name, ipInfo) => {
  const mailOptions = {
    from: `"LUXEMART Security" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '🔐 New Login Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #000 0%, #1a1a1a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code { background: #000; color: #fff; font-size: 36px; font-weight: bold; padding: 20px; text-align: center; letter-spacing: 10px; border-radius: 8px; margin: 30px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .brand { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .brand span { color: #d4af37; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">LUXE<span>MART</span></div>
            <p>Premium Shopping Destination</p>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">Hello ${name},</h2>
            
            <div class="warning">
              <strong>⚠️ New Login Detected</strong>
            </div>
            
            <p>A login attempt was made from a new location:</p>
            
            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; background: #eee;"><strong>IP Address:</strong></td>
                <td style="padding: 8px;">${ipInfo.ip || 'Unknown'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; background: #eee;"><strong>Device:</strong></td>
                <td style="padding: 8px;">${ipInfo.userAgent || 'Unknown'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; background: #eee;"><strong>Time:</strong></td>
                <td style="padding: 8px;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
            
            <p>Your verification code is:</p>
            
            <div class="code">${code}</div>
            
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            
            <p>If this was you, simply enter this code to complete your login.</p>
            
            <p><strong>If this wasn't you</strong>, please secure your account immediately:</p>
            <ul>
              <li>Change your password</li>
              <li>Contact customer support</li>
            </ul>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} LUXEMART. All rights reserved.</p>
            <p>Secure 256-bit SSL Encrypted</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  return await transporter.sendMail(mailOptions);
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, name) => {
  const mailOptions = {
    from: `"LUXEMART Team" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Welcome to LUXEMART! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #000 0%, #1a1a1a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .brand { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .brand span { color: #d4af37; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">LUXE<span>MART</span></div>
            <p>Premium Shopping Destination</p>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">Welcome to LUXEMART, ${name}! 🎉</h2>
            <p>Your email has been successfully verified.</p>
            <p>You now have access to:</p>
            <ul>
              <li>✨ Curated premium products</li>
              <li>🚚 Free shipping on orders over $150</li>
              <li>💎 Member-exclusive deals</li>
              <li>🛡️ Secure shopping experience</li>
            </ul>
            <p>Start exploring our collection today!</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:3000/products" style="display: inline-block; background: #000; color: white; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold;">Shop Now</a>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} LUXEMART. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  return await transporter.sendMail(mailOptions);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendLoginVerificationCode,
  sendWelcomeEmail
};