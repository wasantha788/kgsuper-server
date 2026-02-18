import SellerRequestUser from "../models/SellerRequestUser.js";
import bcrypt from "bcryptjs";

// REGISTER SELLER
export const registerSellerRequest = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await SellerRequestUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const seller = await SellerRequestUser.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "Seller registered successfully",
      seller: {
        id: seller._id,
        name: seller.name,
        email: seller.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
