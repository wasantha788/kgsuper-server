import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/**
 * Register User : POST /api/user/register
 */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.json({ success: false, message: "Missing details." });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.json({ success: false, message: "User already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      user: { email: user.email, name: user.name, cartItems: user.cartItems || {} },
    });
  } catch (error) {
    console.error("Register Error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

/**
 * Login User : POST /api/user/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.json({ success: false, message: "Email and password required." });

    const user = await User.findOne({ email });
    if (!user)
      return res.json({ success: false, message: "Invalid email or password." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.json({ success: false, message: "Invalid email or password." });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      user: { email: user.email, name: user.name, cartItems: user.cartItems || {} },
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * Check Auth : GET /api/user/is-auth
 */
export const isAuth = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.json({ success: false, message: "Not authenticated." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.json({ success: false, message: "User not found." });

    return res.json({ success: true, user });
  } catch (error) {
    console.error("Auth Error:", error.message);
    return res.json({ success: false, message: "Invalid or expired token." });
  }
};

/**
 * Logout User : POST /api/user/logout
 */
export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (error) {
    console.error("Logout Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * Update User Profile : PUT /api/user/update
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id; // from auth middleware
    const { name, email, password } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password");

    return res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Update Profile Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update Cart Items : POST /api/cart/update
 */
export const updateCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cartItems } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { cartItems },
      { new: true }
    ).select("-password");

    return res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Update Cart Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};
