// backend/middlewares/authUser.js
import jwt from 'jsonwebtoken';
import User from '../models/user.js';

const authUser = async (req, res, next) => {
  try {
    console.log('📨 Headers:', req.headers);
    console.log('🔑 Authorization header:', req.headers.authorization);
    console.log('🍪 Cookie token:', req.cookies?.token);
    // 1. Try to get token from cookie
    let token = req.cookies?.token;

    // 2. If not in cookie, check Authorization header (Bearer)
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // 3. (Optional) Fallback to custom 'token' header (if you still use it)
    if (!token && req.headers.token) {
      token = req.headers.token;
    }

    // 4. If still no token, reject
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // 5. Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 6. Ensure payload has an `id` field (your login uses `{ id: user._id }`)
    if (!decoded?.id) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    // 7. Find user and attach to request
    const user = await User.findById(decoded.id).select('_id role isAdmin');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Unauthorized access' });
  }
};

export default authUser;