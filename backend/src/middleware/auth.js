const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authorization required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hey');
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authorization required' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: `${roles.join('/') } access required` });
  }
  next();
};

module.exports = { authenticate, requireRole };
