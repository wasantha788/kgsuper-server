import jwt from "jsonwebtoken";

const authSeller = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    req.cookies?.sellerToken ||
    (authHeader && authHeader.startsWith("Bearer ") && authHeader.split(" ")[1]);

  if (!token) {
    return res.status(401).json({ success: false, message: "You are not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.seller = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    const message = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({ success: false, message });
  }
};

export default authSeller;