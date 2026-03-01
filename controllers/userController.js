import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Helper to generate cookie options
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Register User
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

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.cookie("token", token, cookieOptions);

        return res.json({
            success: true,
            user: { id: user._id, email: user.email, name: user.name, cartItems: user.cartItems || {} },
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

/**
 * Login User
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.json({ success: false, message: "Email and password required." });

        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password)))
            return res.json({ success: false, message: "Invalid email or password." });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.cookie("token", token, cookieOptions);

        return res.json({
            success: true,
            user: { id: user._id, email: user.email, name: user.name, cartItems: user.cartItems || {} },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error." });
    }
};

/**
 * Update Password (Matched to Frontend 'Security Settings')
 */
export const updatePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;

        const user = await User.findById(userId);
        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            return res.json({ success: false, message: "Current password is incorrect." });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.json({ success: true, message: "Password updated successfully." });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete Profile (Matched to Frontend 'Delete Account')
 */
export const deleteProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        await User.findByIdAndDelete(userId);

        res.clearCookie("token", cookieOptions);
        return res.json({ success: true, message: "Account deleted." });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
 
/**
 * Update User General Profile: PUT /api/user/update
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { name, email } = req.body;

    // We don't update password here for security; use updatePassword instead
    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      { name, email }, 
      { new: true }
    ).select("-password");

    if (!updatedUser) return res.json({ success: false, message: "User not found" });

    return res.json({ success: true, user: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
/**
 * Check Auth / Get User Data
 */
export const isAuth = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ success: false, message: "Not authenticated." });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");
        
        if (!user) return res.json({ success: false, message: "User not found." });

        return res.json({ success: true, user });
    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
};

/**
 * Logout
 */
export const logout = async (req, res) => {
    try {
        res.clearCookie("token", cookieOptions);
        return res.status(200).json({ success: true, message: "Logged out." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error." });
    }
};

/**
 * Update Cart Items
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
    return res.status(500).json({ success: false, message: error.message });
  }
};