import jwt from "jsonwebtoken";
import DeliveryBoy from "../models/DeliveryBoy.js";

const authDelivery = async (req, res, next) => {
  try {
    // ✅ 1. Authorization Header එක ලබා ගන්න
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization header missing or invalid" });
    }

    const token = authHeader.split(" ")[1];

    // ✅ 2. Token එක Verify කරන්න
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");

    // ✅ 3. Token එකේ id සහ role තිබේදැයි පරීක්ෂා කරන්න
    if (!decoded.id || decoded.role !== 'delivery') {
      return res.status(403).json({ message: "Access denied: Invalid token role" });
    }

    // ✅ 4. Delivery Boy එක Database එකෙන් සොයා ගන්න
    const deliveryBoy = await DeliveryBoy.findById(decoded.id).select("-password");
    if (!deliveryBoy) {
      return res.status(401).json({ message: "Delivery boy not found" });
    }

    // ✅ 5. Request object එකට deliveryBoy attach කරන්න
    req.deliveryBoy = deliveryBoy;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default authDelivery;