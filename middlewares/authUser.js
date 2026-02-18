import jwt from "jsonwebtoken";
import User from "../models/user.js";

const authUser = async (req, res, next) => {
  try {
    // Get token from cookie or header
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token)
      return res.status(401).json({ success: false, message: "Authentication required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id)
      return res.status(401).json({ success: false, message: "Invalid token" });

    const user = await User.findById(decoded.id);
    if (!user)
      return res.status(401).json({ success: false, message: "User not found" });

    // Attach full user object to request
    req.user = user; // ✅ now req.user._id exists
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error.message);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Session expired. Please login again." });
    }
    return res.status(401).json({ success: false, message: "Unauthorized access" });
  }
};

export default authUser;
