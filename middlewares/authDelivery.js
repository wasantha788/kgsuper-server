import jwt from "jsonwebtoken";
import DeliveryBoy from "../models/DeliveryBoy.js";

const authDelivery = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");

    if (!decoded.id) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const deliveryBoy = await DeliveryBoy.findById(decoded.id).select("-password");

    if (!deliveryBoy) {
      return res.status(401).json({ message: "Delivery boy not found" });
    }

    req.deliveryBoy = deliveryBoy; // ✅ attach to request
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default authDelivery;
