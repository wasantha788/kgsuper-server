import jwt from "jsonwebtoken";

const authSeller = async (req, res, next) => {
  const token =
    req.cookies?.sellerToken ||
    req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "You are not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.seller = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid token" });
  }
};


export default authSeller;
