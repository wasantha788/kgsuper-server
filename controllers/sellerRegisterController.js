import SellerRequestUser from "../models/SellerRequestUser.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import SibApiV3Sdk from "sib-api-v3-sdk";

// Initialize Brevo client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

// REGISTER SELLER WITH EMAIL VERIFICATION (Brevo)
export const registerSellerRequest = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email already exists
    const existingUser = await SellerRequestUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Create seller
    const seller = await SellerRequestUser.create({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
    });

    // Prepare Brevo transactional email
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const verifyUrl = `https://kgsuper-server-production.up.railway.app/api/verify/verify-email?token=${verificationToken}`;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
      sender: { name: "K.G SUPER Marketplace", email: process.env.BREVO_USER },
      to: [{ email: seller.email, name: seller.name }],
      subject: "Verify your email",
      htmlContent: `
        <h2>Welcome, ${seller.name}!</h2>
        <p>Click the link below to verify your email and activate your account:</p>
        <a href="${verifyUrl}" target="_blank">Verify Email</a>
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