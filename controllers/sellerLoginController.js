import bcrypt from "bcryptjs";
import SellerRequestUser from "../models/SellerRequestUser.js";
import jwt from "jsonwebtoken";

export const loginSellerRequest = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const seller = await SellerRequestUser.findOne({ email });

    if (!seller) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, seller.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // ✅ CREATE TOKEN
    const token = jwt.sign(
      { id: seller._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token, // 🔥 VERY IMPORTANT
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