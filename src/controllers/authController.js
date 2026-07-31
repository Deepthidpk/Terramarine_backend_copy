const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const sendEmail = require('../utils/sendEmail');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role, name: user.full_name },
    process.env.JWT_SECRET || 'super_secret_terramarine_token_key_123!',
    { expiresIn: '24h' }
  );
};

// 1. Standard Register
exports.register = async (req, res) => {
  const { 
    full_name, email, phone, password, role, 
    organization_name, address, district, state,
    registration_number, organization_address,
    institution_name, department, research_area,
    government_id_type, government_id_number,
    fishing_license_number, boat_registration_number
  } = req.body;

  // 1. Basic required fields check
  if (!full_name || !email || !password || !role || !address || !district || !state) {
    return res.status(400).json({ error: 'Please provide all required fields (full_name, email, password, role, address, district, state).' });
  }

  // 2. Format & length checks
  if (full_name.trim().length < 2 || !/^[A-Za-z\s]+$/.test(full_name)) {
    return res.status(400).json({ error: 'Full name must be at least 2 characters and contain only letters and spaces.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (phone && !/^[0-9]{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Phone number must be exactly 10 digits.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  if (address.trim().length < 5) {
    return res.status(400).json({ error: 'Address must be at least 5 characters.' });
  }

  if (!/^[A-Za-z\s]+$/.test(district)) {
    return res.status(400).json({ error: 'District can only contain letters and spaces.' });
  }

  if (!/^[A-Za-z\s]+$/.test(state)) {
    return res.status(400).json({ error: 'State can only contain letters and spaces.' });
  }

  // Prevent self-registration of Admin and Authority roles
  if (['Admin', 'Authority'].includes(role)) {
    return res.status(400).json({ error: 'Self-registration for this role is not permitted.' });
  }

  try {
    // Check if user exists by email or phone
    const emailCheck = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    if (phone) {
      const phoneCheck = await db.query('SELECT user_id FROM users WHERE phone = $1', [phone]);
      if (phoneCheck.rows.length > 0) {
        return res.status(400).json({ error: 'A user with this phone number already exists.' });
      }
    }

    // Process files and validate required fields by role
    let registration_certificate_url = null;
    let institution_id_url = null;
    let government_id_url = null;
    let status = 'Active';

    if (role === 'NGO') {
      status = 'Pending';
      if (!organization_name || !registration_number || !organization_address) {
        return res.status(400).json({ error: 'Please provide organization name, registration number, and organization address.' });
      }
      if (organization_name.trim().length < 3) {
        return res.status(400).json({ error: 'Organization name must be at least 3 characters.' });
      }
      if (registration_number.trim().length < 5) {
        return res.status(400).json({ error: 'Registration number must be at least 5 characters.' });
      }
      if (organization_address.trim().length < 10) {
        return res.status(400).json({ error: 'Organization address must be at least 10 characters.' });
      }
      if (!req.files || !req.files['registration_certificate']) {
        return res.status(400).json({ error: 'Please upload the registration certificate.' });
      }
      const file = req.files['registration_certificate'][0];
      registration_certificate_url = `/api/admin/documents/${file.filename}`;
    } else if (role === 'Researcher') {
      status = 'Pending';
      if (!institution_name || !department || !research_area) {
        return res.status(400).json({ error: 'Please provide institution name, department, and research area.' });
      }
      if (institution_name.trim().length < 3) {
        return res.status(400).json({ error: 'Institution name must be at least 3 characters.' });
      }
      if (department.trim().length < 2) {
        return res.status(400).json({ error: 'Department must be at least 2 characters.' });
      }
      if (research_area.trim().length < 5) {
        return res.status(400).json({ error: 'Research area must be at least 5 characters.' });
      }
      if (!req.files || !req.files['institution_id']) {
        return res.status(400).json({ error: 'Please upload the institution ID card.' });
      }
      const file = req.files['institution_id'][0];
      institution_id_url = `/api/admin/documents/${file.filename}`;
    } else if (role === 'Volunteer') {
      status = 'Active';
      if (!government_id_type || !government_id_number) {
        return res.status(400).json({ error: 'Please provide government ID type and number.' });
      }
      if (!['Aadhaar', 'Driving License', 'Passport', 'Voter ID'].includes(government_id_type)) {
        return res.status(400).json({ error: 'Invalid government ID type selected.' });
      }
      if (government_id_type === 'Aadhaar' && !/^[0-9]{12}$/.test(government_id_number)) {
        return res.status(400).json({ error: 'Aadhaar number must be exactly 12 digits.' });
      }
      if (government_id_number.trim().length < 5) {
        return res.status(400).json({ error: 'Government ID number must be at least 5 characters.' });
      }
      if (!req.files || !req.files['government_id']) {
        return res.status(400).json({ error: 'Please upload your government ID document.' });
      }
      const file = req.files['government_id'][0];
      government_id_url = `/api/admin/documents/${file.filename}`;
    } else if (role === 'Fisherman') {
      status = 'Active';
      if (!fishing_license_number || !boat_registration_number) {
        return res.status(400).json({ error: 'Please provide fishing license number and boat registration number.' });
      }
      if (fishing_license_number.trim().length < 5) {
        return res.status(400).json({ error: 'Fishing license number must be at least 5 characters.' });
      }
      if (boat_registration_number.trim().length < 5) {
        return res.status(400).json({ error: 'Boat registration number must be at least 5 characters.' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const insertQuery = `
      INSERT INTO users 
      (full_name, email, phone, password_hash, role, organization_name, address, district, state, status,
       registration_number, organization_address, registration_certificate_url,
       institution_name, department, research_area, institution_id_url,
       government_id_type, government_id_number, government_id_url,
       fishing_license_number, boat_registration_number) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) 
      RETURNING user_id, full_name, email, role, status, created_at
    `;
    const values = [
      full_name, email, phone || null, passwordHash, role, 
      organization_name || null, address || null, district || null, state || null, status,
      registration_number || null, organization_address || null, registration_certificate_url,
      institution_name || null, department || null, research_area || null, institution_id_url,
      government_id_type || null, government_id_number || null, government_id_url,
      fishing_license_number || null, boat_registration_number || null
    ];
    
    const result = await db.query(insertQuery, values);
    const newUser = result.rows[0];

    // Send Welcome email asynchronously
    sendEmail({
      to: newUser.email,
      subject: '🌊 Welcome to TerraMarine!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #171c42; background: #f8fafc; border-radius: 12px; max-width: 550px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <h2 style="color: #00bbf9; margin-top: 0;">🌊 Welcome to TerraMarine</h2>
          <p>Hello <strong>${newUser.full_name}</strong>,</p>
          <p>Thank you for registering on <strong>TerraMarine</strong> — India's premier coastal pollution & marine conservation platform.</p>
          <p><strong>Account Role:</strong> ${newUser.role}</p>
          <p><strong>Account Status:</strong> ${status} ${status === 'Pending' ? '(Awaiting Admin Approval)' : '(Active)'}</p>
          <br/>
          <p style="font-size: 0.9rem;">Together for cleaner oceans,<br/><strong>The TerraMarine Team</strong></p>
        </div>
      `
    }).catch(err => console.error('Welcome email dispatch warning:', err.message));

    if (status === 'Pending') {
      res.status(201).json({ 
        message: 'Your registration has been submitted successfully and is awaiting administrator approval.',
        status: 'Pending',
        user: {
          user_id: newUser.user_id,
          full_name: newUser.full_name,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status
        }
      });
    } else {
      const token = generateToken(newUser);
      res.status(201).json({ token, user: newUser, status: 'Active' });
    }

  } catch (error) {
    console.error('Registration Error:', error);
    if (error.code === '23505') {
      if (error.constraint === 'users_phone_key' || (error.detail && error.detail.includes('phone'))) {
        return res.status(400).json({ error: 'A user with this phone number already exists.' });
      }
      if (error.constraint === 'users_email_key' || (error.detail && error.detail.includes('email'))) {
        return res.status(400).json({ error: 'A user with this email address already exists.' });
      }
      return res.status(400).json({ error: 'A user with this email address or phone number already exists.' });
    }
    res.status(500).json({ error: 'Server error during user registration.' });
  }
};

// 2. Standard Login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    if (user.status === 'Pending') {
      return res.status(403).json({ error: 'Your registration has been submitted successfully and is awaiting administrator approval.' });
    } else if (user.status === 'Rejected') {
      return res.status(403).json({ error: 'Your registration request has been rejected. Please contact the administrator.' });
    } else if (user.status === 'Suspended') {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    } else if (user.status !== 'Active') {
      return res.status(403).json({ error: `Account is ${user.status.toLowerCase()}. Please contact an administrator.` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        organization_name: user.organization_name,
        profile_image: user.profile_image,
        district: user.district,
        state: user.state,
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

// Helper to fetch userinfo from Google API using native https
const fetchGoogleUserInfo = (accessToken) => {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      path: '/oauth2/v3/userinfo',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Google UserInfo API returned HTTP ${res.statusCode}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
};

// 3. Google Sign-In / Sign-Up
exports.googleLogin = async (req, res) => {
  const tokenInput = req.body.token || req.body.credential || req.body.access_token;

  if (!tokenInput) {
    return res.status(400).json({ error: 'Google authentication token is required.' });
  }

  try {
    let email, name, picture, google_id;

    // 1. Try Google ID Token verification
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: tokenInput,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
      google_id = payload.sub;
    } catch (idTokenError) {
      // 2. Try Google Access Token verification via UserInfo API
      try {
        const userInfo = await fetchGoogleUserInfo(tokenInput);
        email = userInfo.email;
        name = userInfo.name;
        picture = userInfo.picture;
        google_id = userInfo.sub;
      } catch (userInfoError) {
        // 3. Fallback mock JWT decode for development/testing
        try {
          const decoded = jwt.decode(tokenInput);
          if (decoded && decoded.email) {
            email = decoded.email;
            name = decoded.name || decoded.email.split('@')[0];
            picture = decoded.picture || null;
            google_id = decoded.sub || `google_mock_${Date.now()}`;
          } else {
            return res.status(400).json({ error: 'Invalid Google authentication token.' });
          }
        } catch (decErr) {
          return res.status(400).json({ error: 'Invalid Google authentication token.' });
        }
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Email could not be verified from Google account.' });
    }

    // Check if user exists in database by email or google_id
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1 OR (google_id IS NOT NULL AND google_id = $2)',
      [email, google_id]
    );

    if (userResult.rows.length === 0) {
      // User DOES NOT exist -> return isNewUser flag and google profile data so user can pick role & upload required documents
      return res.json({
        isNewUser: true,
        googleData: {
          email,
          full_name: name,
          picture,
          google_id
        }
      });
    }

    // User EXISTS -> Process standard login
    const user = userResult.rows[0];
    if (!user.google_id && google_id) {
      await db.query('UPDATE users SET google_id = $1 WHERE user_id = $2', [google_id, user.user_id]);
    }

    if (user.status === 'Pending') {
      return res.status(403).json({ error: 'Your registration has been submitted successfully and is awaiting administrator approval.' });
    } else if (user.status === 'Rejected') {
      return res.status(403).json({ error: 'Your registration request has been rejected. Please contact the administrator.' });
    } else if (user.status === 'Suspended') {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    } else if (user.status !== 'Active') {
      return res.status(403).json({ error: `Account is ${user.status.toLowerCase()}. Please contact an administrator.` });
    }

    const token = generateToken(user);
    res.json({
      isNewUser: false,
      token,
      role: user.role,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        organization_name: user.organization_name,
        profile_image: user.profile_image || picture,
        district: user.district,
        state: user.state,
      },
      redirect: '/dashboard'
    });
  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(500).json({ error: 'Server error during Google authentication.' });
  }
};

// 4. Complete Google Registration for New Users with Selected Role & Documents
exports.googleRegister = async (req, res) => {
  const { 
    full_name, email, google_id, profile_image, role, phone,
    address, district, state,
    organization_name, registration_number, organization_address,
    institution_name, department, research_area,
    government_id_type, government_id_number,
    fishing_license_number, boat_registration_number
  } = req.body;

  if (!email || !full_name || !role) {
    return res.status(400).json({ error: 'Full name, email, and role are required.' });
  }

  if (['Admin', 'Authority'].includes(role)) {
    return res.status(400).json({ error: 'Self-registration for this role is not permitted.' });
  }

  try {
    // Double-check email uniqueness
    const existingCheck = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    let registration_certificate_url = null;
    let institution_id_url = null;
    let government_id_url = null;
    let status = 'Active';

    if (role === 'NGO') {
      status = 'Pending';
      if (!organization_name || !registration_number || !organization_address) {
        return res.status(400).json({ error: 'Please provide organization name, registration number, and organization address.' });
      }
      if (!req.files || !req.files['registration_certificate']) {
        return res.status(400).json({ error: 'Please upload the registration certificate.' });
      }
      const file = req.files['registration_certificate'][0];
      registration_certificate_url = `/api/admin/documents/${file.filename}`;
    } else if (role === 'Researcher') {
      status = 'Pending';
      if (!institution_name || !department || !research_area) {
        return res.status(400).json({ error: 'Please provide institution name, department, and research area.' });
      }
      if (!req.files || !req.files['institution_id']) {
        return res.status(400).json({ error: 'Please upload the institution ID card.' });
      }
      const file = req.files['institution_id'][0];
      institution_id_url = `/api/admin/documents/${file.filename}`;
    } else if (role === 'Volunteer') {
      status = 'Active';
      if (!government_id_type || !government_id_number) {
        return res.status(400).json({ error: 'Please provide government ID type and number.' });
      }
      if (!req.files || !req.files['government_id']) {
        return res.status(400).json({ error: 'Please upload your government ID document.' });
      }
      const file = req.files['government_id'][0];
      government_id_url = `/api/admin/documents/${file.filename}`;
    } else if (role === 'Fisherman') {
      status = 'Active';
      if (!fishing_license_number || !boat_registration_number) {
        return res.status(400).json({ error: 'Please provide fishing license number and boat registration number.' });
      }
    }

    const randomPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const insertQuery = `
      INSERT INTO users 
      (full_name, email, google_id, phone, password_hash, role, profile_image, organization_name, address, district, state, status,
       registration_number, organization_address, registration_certificate_url,
       institution_name, department, research_area, institution_id_url,
       government_id_type, government_id_number, government_id_url,
       fishing_license_number, boat_registration_number) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) 
      RETURNING user_id, full_name, email, role, status, profile_image, created_at
    `;
    const values = [
      full_name, email, google_id || null, phone || null, passwordHash, role, profile_image || null,
      organization_name || null, address || null, district || null, state || null, status,
      registration_number || null, organization_address || null, registration_certificate_url,
      institution_name || null, department || null, research_area || null, institution_id_url,
      government_id_type || null, government_id_number || null, government_id_url,
      fishing_license_number || null, boat_registration_number || null
    ];

    const result = await db.query(insertQuery, values);
    const newUser = result.rows[0];

    if (status === 'Pending') {
      return res.status(201).json({
        isNewUser: false,
        status: 'Pending',
        message: 'Your registration has been submitted successfully and is awaiting administrator approval.',
        user: newUser
      });
    }

    const token = generateToken(newUser);
    res.status(201).json({
      isNewUser: false,
      token,
      role: newUser.role,
      user: newUser,
      redirect: '/dashboard'
    });
  } catch (error) {
    console.error('Google Complete Registration Error:', error);
    res.status(500).json({ error: 'Server error during Google registration completion.' });
  }
};

// 4. Forgot Password Request
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Please provide email address.' });
  }

  try {
    const result = await db.query('SELECT user_id, full_name FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with that email address.' });
    }

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await db.query(
      'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE user_id = $3',
      [resetToken, resetExpires, user.user_id]
    );

    const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`;
    const senderEmail = process.env.SMTP_FROM || 'terramarine33@gmail.com';


    console.log('\n==================================================');
    console.log(`PASSWORD RESET REQUESTED FOR: ${email}`);
    console.log(`SENDER EMAIL: ${senderEmail}`);
    console.log(`RESET URL: ${resetUrl}`);
    console.log('==================================================\n');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #171c42; background: #f8fafc; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0;">
        <h2 style="color: #00bbf9; margin-top: 0;">🌊 TerraMarine Password Reset</h2>
        <p>Hello <strong>${user.full_name}</strong>,</p>
        <p>We received a request to reset your password for your TerraMarine account.</p>
        <p>Please click the button below to set a new password:</p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${resetUrl}" target="_blank" style="background: #00bbf9; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 0.85rem; color: #64748b;">Or copy and paste this link into your browser:<br/><a href="${resetUrl}" style="color: #00bbf9;">${resetUrl}</a></p>
        <p style="font-size: 0.85rem; color: #64748b;">This password reset link is valid for 1 hour.</p>
        <br/>
        <p style="font-size: 0.9rem;">Best regards,<br/><strong>The TerraMarine Team</strong></p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: 'TerraMarine - Password Reset Link',
      html: emailHtml,
    });

    res.json({ 
      message: `Password reset link has been sent to ${email}. Please check your inbox and spam folder.`
    });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Server error during forgot password.' });
  }
};

// 5. Reset Password Request
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  try {
    const result = await db.query(
      'SELECT user_id, reset_password_expires FROM users WHERE reset_password_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    const user = result.rows[0];
    const expiry = new Date(user.reset_password_expires);

    if (expiry < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user
    await db.query(
      'UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE user_id = $2',
      [passwordHash, user.user_id]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Server error during password reset.' });
  }
};

// 6. Get Profile
exports.getProfile = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT user_id, full_name, email, phone, role, organization_name, profile_image, address, district, state, status, created_at FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ error: 'Server error retrieving profile.' });
  }
};

// 7. Test Email Endpoint
exports.testEmail = async (req, res) => {
  const targetEmail = req.body?.email || req.query?.email || process.env.SMTP_USER || 'terramarine33@gmail.com';
  try {
    const result = await sendEmail({
      to: targetEmail,
      subject: '🌊 TerraMarine Email Test Dispatch',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #171c42; background: #f8fafc; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <h2 style="color: #00bbf9; margin-top: 0;">🌊 TerraMarine Email System</h2>
          <p>Hello,</p>
          <p>This is a live test email sent from <strong>terramarine33@gmail.com</strong>!</p>
          <p>If you are receiving this message, your mail sending setup is 100% operational.</p>
          <br/>
          <p style="font-size: 0.85rem; color: #64748b;">Timestamp: ${new Date().toLocaleString()}</p>
        </div>
      `
    });
    res.json({ message: `Test email dispatched successfully to ${targetEmail}`, result });
  } catch (err) {
    console.error('Test Email Controller Error:', err);
    res.status(500).json({ error: 'Failed to send test email', details: err.message });
  }
};

