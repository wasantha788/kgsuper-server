import express from "express";
import SellerRequestUser from "../models/SellerRequestUser.js";

const router = express.Router();

router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    const seller = await SellerRequestUser.findOne({ verificationToken: token });

    if (!seller) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    seller.isVerified = true;
    seller.verificationToken = undefined;
    await seller.save();

    res.json({ message: "Email verified successfully" });

  } catch (error) {
    console.error("VERIFY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;