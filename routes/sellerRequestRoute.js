import express from "express";
import multer from "multer";
import SellerRequestProduct from "../models/sellerRequestProduct.js";
import cloudinary from "../configs/cloudinary.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// ============================
// Multer Config (MEMORY STORAGE)
// ============================
// Using memoryStorage prevents "ENOENT: no such file or directory" on Railway
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit per file
});

// ============================
// Email Transporter
// ============================
    const createTransporter = () =>
  nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Ensure spaces are removed: "zfsayfuvhfnmxtuw"
    },
    // Keep these to prevent hanging
    connectionTimeout: 10000, 
    greetingTimeout: 10000,
  });
// ============================
// GET: Fetch all requests
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
// POST: Create product request
// ============================
router.post("/products", upload.array("images", 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "At least one image is required" });
    }

    // Parallel upload to Cloudinary using Streams
    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "seller_requests" },
          (error, result) => {
            if (result) resolve({ url: result.secure_url, publicId: result.public_id });
            else reject(error);
          }
        );
        stream.end(file.buffer);
      });
    });

    const uploadedImages = await Promise.all(uploadPromises);

    const product = new SellerRequestProduct({
      ...req.body,
      images: uploadedImages,
      status: "pending",
    });

    await product.save();
    res.status(201).json({ success: true, product });

  } catch (err) {
    console.error("❌ POST Error:", err);
    res.status(500).json({ success: false, message: "Upload failed: " + err.message });
  }
});

// ============================
// PATCH: Update status & Notify Seller
// ============================
router.patch("/update-status/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const product = await SellerRequestProduct.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Attempt to send email but don't crash the whole request if it fails
    let emailSent = false;
    if (product.sellerEmail) {
      try {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: `"K.G SUPER Marketplace" <${process.env.EMAIL_USER}>`,
          to: product.sellerEmail,
          subject: `Product Update: ${status.toUpperCase()}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
              <h2 style="color: #059669;">Hello ${product.sellerName},</h2>
              <p>Your product submission "<strong>${product.name}</strong>" has been <strong>${status.toUpperCase()}</strong> by the administrator.</p>
              <p>Log in to your portal to see more details.</p>
              <br/>
              <p style="font-size: 12px; color: #64748b;">Thank you for choosing K.G SUPER Marketplace.</p>
            </div>
          `,
        });
        emailSent = true;
      } catch (emailError) {
        console.error("❌ EMAIL FAILED:", emailError.message);
      }
    }

    res.json({
      success: true,
      message: emailSent ? "Status updated and seller notified" : "Status updated (Email failed)",
      product,
    });

  } catch (err) {
    console.error("Update Status Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================
// DELETE: Remove Product & Cloudinary Assets
// ============================
router.delete("/:id", async (req, res) => {
  try {
    const product = await SellerRequestProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Clean up Cloudinary storage
    if (product.images && product.images.length > 0) {
      const deletePromises = product.images.map(img => 
        cloudinary.uploader.destroy(img.publicId)
      );
      await Promise.all(deletePromises);
    }

    await SellerRequestProduct.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product and images deleted" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;