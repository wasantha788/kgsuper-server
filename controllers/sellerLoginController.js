import bcrypt from "bcryptjs";
import SellerRequestUser from "../models/SellerRequestUser.js";
import jwt from "jsonwebtoken";

export const loginSellerRequest = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2️⃣ Find seller
    const seller = await SellerRequestUser.findOne({ email });

    if (!seller) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 3️⃣ Check email verification FIRST
    if (!seller.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
      });
    }

    // 4️⃣ Check password (ONLY ONCE)
    const isMatch = await bcrypt.compare(password, seller.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 5️⃣ Create JWT
    const token = jwt.sign(
      { id: seller._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 6️⃣ Send response
    res.status(200).json({
      message: "Login successful",
      token,
      seller: {
        id: seller._id,
        name: seller.name,
        email: seller.email,
      },
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};