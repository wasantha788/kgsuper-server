import User from "../models/user.js";

export const updateCart = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
    const { cartItems } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.cartItems = cartItems;
    user.markModified("cartItems");
    await user.save();

    res.json({ success: true, message: "Cart Updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
