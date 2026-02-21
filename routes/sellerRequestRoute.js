import express from "express";
import multer from "multer";
import path from "path";
import SellerRequestProduct from "../models/sellerRequestProduct.js";
import connectCloudinary from "../configs/cloudinary.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// ============================
// Initialize Cloudinary
// ============================
const cloudinary = connectCloudinary();

// ============================
// Check required env variables
// ============================
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("❌ EMAIL_USER or EMAIL_PASS missing in .env file");
}

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error("❌ Cloudinary env variables missing");
}

// ============================
// Multer Config (Disk Storage)
// ============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ============================
// Email Transporter
// ============================
const createTransporter = () =>
  nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

// ============================
// GET all seller requests
// ============================
router.get("/", async (req, res) => {
  try {
    const products = await SellerRequestProduct.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    console.error("GET Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================
// CREATE seller request (POST)
// ============================
router.post("/products", upload.array("images", 4), async (req, res) => {
  try {
    const uploadedImages = [];

    // Use a loop to handle memory buffers
    for (const file of req.files) {
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "seller_requests" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        // Pipe the buffer to Cloudinary
        uploadStream.end(file.buffer);
      });

      const result = await uploadPromise;
      uploadedImages.push({ url: result.secure_url, publicId: result.public_id });
    }

    const product = new SellerRequestProduct({
      ...req.body,
      images: uploadedImages,
      status: "pending",
    });

    await product.save();
    res.json({ success: true, product });
  } catch (err) {
    console.error("POST Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================
// UPDATE product status + send email
// ============================
router.patch("/update-status/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    const product = await SellerRequestProduct.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    let emailSent = false;
    if (product.sellerEmail) {
      try {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: `"K.G SUPER Marketplace" <${process.env.EMAIL_USER}>`,
          to: product.sellerEmail,
          subject: `Your Product Has Been ${status.toUpperCase()}`,
          html: `
            <h2>Hello ${product.sellerName || "Seller"},</h2>
            <p>Your product "<strong>${product.name}</strong>" has been <strong>${status.toUpperCase()}</strong>.</p>
            <br/>
            <p>Thank you for using K.G SUPER Marketplace.</p>
          `,
        });
        emailSent = true;
      } catch (emailError) {
        console.error("❌ EMAIL FAILED:", emailError.message);
      }
    }

    res.json({
      success: true,
      message: emailSent
        ? "Status updated & email sent"
        : "Status updated but email failed",
      emailSent,
      product,
    });
  } catch (err) {
    console.error("Update Status Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================
// DELETE product + remove from Cloudinary
// ============================
router.delete("/:id", async (req, res) => {
  try {
    const product = await SellerRequestProduct.findById(req.params.id);
    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    // Delete each image from Cloudinary
    if (product.images?.length) {
      for (const img of product.images) {
        try {
          await cloudinary.uploader.destroy(img.publicId);
        } catch (err) {
          console.warn("Cloudinary delete failed for", img.url);
        }
      }
    }

    await SellerRequestProduct.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;