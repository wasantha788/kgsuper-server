import SellerRequestUser from "../models/SellerRequestUser.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import SibApiV3Sdk from "sib-api-v3-sdk";

// ---------------- Brevo Email Setup ----------------
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

// ---------------- REGISTER SELLER WITH EMAIL VERIFICATION ----------------
export const registerSellerRequest = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check for existing email
    const existingUser = await SellerRequestUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token & expiry (24h)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Create the seller
    const seller = await SellerRequestUser.create({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
      verificationExpires,
    });

    // Send verification email via Brevo
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&id=${seller._id}`;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
      sender: { name: "K.G SUPER Marketplace", email: process.env.BREVO_USER },
      to: [{ email: seller.email, name: seller.name }],
      subject: "Verify your email - K.G SUPER Marketplace",
      htmlContent: `
        <div style="font-family:sans-serif; padding:20px; border:1px solid #e2e8f0; border-radius:10px;">
          <h2 style="color:#059669;">Welcome, ${seller.name}!</h2>
          <p>Click the link below to verify your email and activate your account:</p>
          <a href="${verifyUrl}" target="_blank" style="display:inline-block; padding:10px 20px; background:#059669; color:white; border-radius:5px; text-decoration:none;">Verify Email</a>
          <p style="font-size:12px; color:#64748b;">This link will expire in 24 hours.</p>
        </div>
      `,
    });

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    res.status(201).json({
      message: "Seller registered successfully! Please check your email to verify your account.",
      seller: {
        id: seller._id,
        name: seller.name,
        email: seller.email,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};