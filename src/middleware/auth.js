const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_terramarine_token_key_123!');
    
    // Check real-time user status in Database
    const userRes = await db.query(
      `SELECT user_id, email, role, full_name, status, organization_name, district, state 
       FROM users WHERE user_id = $1`,
      [verified.user_id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    const dbUser = userRes.rows[0];

    // Check if user's parent organization is suspended
    let isOrgSuspended = false;
    if (dbUser.organization_name) {
      const orgRes = await db.query(
        "SELECT status FROM users WHERE (organization_name = $1 OR full_name = $1) AND role = 'Authority'",
        [dbUser.organization_name]
      );
      if (orgRes.rows.length > 0 && orgRes.rows[0].status === 'Suspended') {
        isOrgSuspended = true;
      }
    }

    // Security Check: Block access if account or organization is suspended
    if (dbUser.status === 'Suspended' || isOrgSuspended) {
      return res.status(403).json({ 
        error: 'Account suspended. Your account or organization has been suspended by an administrator.',
        isSuspended: true 
      });
    }

    if (dbUser.status === 'Pending' || dbUser.status === 'Rejected') {
      return res.status(403).json({ 
        error: `Account is currently ${dbUser.status.toLowerCase()}. Access denied.`,
        isSuspended: true 
      });
    }

    req.user = {
      ...verified,
      status: dbUser.status,
      district: dbUser.district || verified.district,
      organization_name: dbUser.organization_name || verified.organization_name
    };
    
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    
    const hasRole = Array.isArray(roles) 
      ? roles.includes(req.user.role) 
      : req.user.role === roles;

    if (!hasRole) {
      return res.status(403).json({ error: 'Access forbidden. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  requireRole,
};
