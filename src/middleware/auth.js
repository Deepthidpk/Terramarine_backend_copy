const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_terramarine_token_key_123!');
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid or expired token.' });
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
