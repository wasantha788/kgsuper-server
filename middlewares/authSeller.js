import jwt from "jsonwebtoken";
import Seller from "../models/sellerModel.js"; // Import the model definition to extract accurate IDs

const authSeller = async (req, res, next) => {
  try {
    const token = req.headers.token || req.headers.sellertoken || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "Not Authorized. Login Again." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    let sellerId = decoded.id || decoded._id;
    if (!sellerId && decoded.email) {
      const existingSeller = await Seller.findOne({ email: decoded.email.toLowerCase() });
      if (existingSeller) {
        sellerId = existingSeller._id;
      }
    }

    if (!sellerId) {
      return res.status(401).json({ success: false, message: "Invalid token payload structural properties." });
    }

    // ✅ සම්මත ලෙස req.sellerId Set කරන්න
    req.sellerId = sellerId;
    
    // ✅ req.seller Object එකත් Set කරන්න (විකල්ප)
    req.seller = {
      _id: sellerId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(401).json({ success: false, message: "Session expired or invalid token." });
  }
};

export default authSeller;