import bcrypt from "bcryptjs";
import SellerRequestUser from "../models/SellerRequestUser.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import SibApiV3Sdk from "sib-api-v3-sdk";

// ---------------- ENV VALIDATION ----------------
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in environment variables");
}

if (!process.env.BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY is missing in environment variables");
}

if (!process.env.BREVO_USER) {
  throw new Error("BREVO_USER is missing in environment variables");
}

// ---------------- BREVO SETUP ----------------
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey =
  process.env.BREVO_API_KEY;

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

// ---------------- HELPER: SEND VERIFICATION EMAIL ----------------

export const sendVerificationEmail = async (seller) => {
  const senderEmail = process.env.BREVO_USER?.trim();
  if (!senderEmail) throw new Error("BREVO_USER is missing");

  const verifyUrl = `${process.env.VITE_CLIENT_URL}/verify-email?token=${seller.verificationToken}&id=${seller._id}`;

  const emailPayload = {
    sender: { name: "K.G SUPER Marketplace", email: senderEmail },
    to: [{ email: seller.email }],
    subject: "Verify your email",
    htmlContent: `
      <h2>Welcome ${seller.name}</h2>
      <p>Please verify your email:</p>
      <a href="${verifyUrl}" style="padding:10px 15px;background:#28a745;color:white;text-decoration:none;border-radius:5px;">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    `,
  };

  await emailApi.sendTransacEmail(emailPayload);
};

// =====================================================
// REGISTER
// =====================================================
export const registerSellerRequest = async (req, res) => {
  try {
    let { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "All fields required" });

    email = email.toLowerCase().trim();
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const existingUser = await SellerRequestUser.findOne({ email });
    if (existingUser) {
      if (!existingUser.isVerified) return res.status(400).json({ message: "Email already registered but not verified." });
      return res.status(400).json({ message: "Email already registered" });
    }

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours from now

    const seller = await SellerRequestUser.create({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
      verificationExpires, // <-- Add this
    });

    await sendVerificationEmail(seller);

    res.status(201).json({ message: "Registration successful. Check your email to verify." });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// =====================================================
// LOGIN
// =====================================================
export const loginSellerRequest = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    email = email.toLowerCase().trim();

    const seller = await SellerRequestUser.findOne({ email });

    if (!seller) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    if (!seller.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
      });
    }

    const isMatch = await bcrypt.compare(password, seller.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: seller._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

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



// =====================================================
// VERIFY EMAIL
// =====================================================
export const verifySellerEmail = async (req, res) => {
  try {
    const { token, id } = req.query;
    if (!token || !id) return res.status(400).json({ message: "Invalid verification link" });

    const seller = await SellerRequestUser.findOne({
      _id: id,
      verificationToken: token,
      verificationExpires: { $gt: Date.now() }, // <-- ensures not expired
    });

    if (!seller) {
      return res.status(400).json({ message: "Invalid or expired verification token" });
    }

    seller.isVerified = true;
    seller.verificationToken = undefined;
    seller.verificationExpires = undefined;
    await seller.save();

    res.json({ message: "Email verified successfully!" });
  } catch (error) {
    console.error("VERIFY ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};