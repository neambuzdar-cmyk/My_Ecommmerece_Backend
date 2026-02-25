const nodemailer = require('nodemailer');

// Create transporter with robust configuration to fix connection issues
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  // Add these options to prevent timeout and IPv6 issues
  connectionTimeout: 60000, // 60 seconds
  greetingTimeout: 30000,   // 30 seconds
  socketTimeout: 60000,     // 60 seconds
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates
    ciphers: 'SSLv3'
  },
  // Force IPv4 to avoid IPv6 connection issues
  family: 4
});

// Enhanced verification with retry logic
const verifyConnection = async (retryCount = 0) => {
  return new Promise((resolve, reject) => {
    transporter.verify((error, success) => {
      if (error) {
        console.log('❌ SMTP Error Details:', {
          message: error.message,
          code: error.code,
          command: error.command,
          retryCount
        });
        
        // Retry logic for common errors
        if (retryCount < 3 && (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED')) {
          console.log(`⚠️ Retrying SMTP connection... (${retryCount + 1}/3)`);
          setTimeout(() => verifyConnection(retryCount + 1).then(resolve).catch(reject), 3000);
        } else {
          console.log('❌ SMTP verification failed after retries');
          // Don't reject - let the app continue but log error
          resolve(false);
        }
      } else {
        console.log('✅ SMTP Server is ready');
        resolve(true);
      }
    });
  });
};

// Initialize connection check
verifyConnection();

// Helper function to ensure email is sent with retry logic
const sendEmailWithRetry = async (mailOptions, retryCount = 0) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${mailOptions.to}`);
    return info;
  } catch (error) {
    console.log(`❌ Failed to send email (attempt ${retryCount + 1}):`, {
      to: mailOptions.to,
      subject: mailOptions.subject,
      error: error.message,
      code: error.code
    });
    
    // Retry up to 2 times for timeout/socket errors
    if (retryCount < 2 && (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED')) {
      console.log(`🔄 Retrying email send... (${retryCount + 1}/2)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return sendEmailWithRetry(mailOptions, retryCount + 1);
    }
    
    throw error;
  }
};

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
  
  return await sendEmailWithRetry(mailOptions);
};

// Send password reset email
const sendPasswordResetEmail = async (email, token, name) => {
  const resetUrl = `https://splendorous-quokka-789382.netlify.app/reset-password/${token}`; // Updated to your Netlify URL
  
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
  
  return await sendEmailWithRetry(mailOptions);
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
  
  return await sendEmailWithRetry(mailOptions);
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
              <a href="https://splendorous-quokka-789382.netlify.app/shop" style="display: inline-block; background: #000; color: white; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold;">Shop Now</a>
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
  
  return await sendEmailWithRetry(mailOptions);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendLoginVerificationCode,
  sendWelcomeEmail
};
