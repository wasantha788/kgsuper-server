import express from "express";
import multer from "multer";
import SellerRequestProduct from "../models/sellerRequestProduct.js";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import SibApiV3Sdk from "sib-api-v3-sdk";

dotenv.config();
const router = express.Router();

// ---------------- Multer ----------------
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ---------------- Cloudinary ----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------- Brevo Email ----------------
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const sendEmail = async ({ to, subject, html }) => {
  try {
    await emailApi.sendTransacEmail({
      sender: { name: "K.G SUPER Marketplace", email: process.env.EMAIL_USER },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });
    return true;
  } catch (err) {
    console.error("Email failed:", err.message);
    return false;
  }
};

// ---------------- GET all requests ----------------
router.get("/", async (req, res) => {
  try {
    const products = await SellerRequestProduct.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    console.error("GET Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- POST product ----------------
router.post("/products", upload.array("images", 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: "At least one image is required" });

    const uploadedImages = await Promise.all(
      req.files.map(file =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "seller_requests" },
            (err, result) => err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id })
          );
          stream.end(file.buffer);
        })
      )
    );

    const product = new SellerRequestProduct({ ...req.body, images: uploadedImages, status: "pending" });
    await product.save();
    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error("POST Error:", err);
    res.status(500).json({ success: false, message: "Upload failed: " + err.message });
  }
});

// ---------------- PATCH status ----------------
router.patch("/update-status/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    const product = await SellerRequestProduct.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    let emailSent = false;
    if (product.sellerEmail) {
      emailSent = await sendEmail({
        to: product.sellerEmail,
        subject: `Product Update: ${status.toUpperCase()}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
            <h2 style="color: #059669;">Hello ${product.sellerName},</h2>
            <p>Your product "<strong>${product.name}</strong>" has been <strong>${status.toUpperCase()}</strong> by the administrator.</p>
            <p>Log in to your portal to see more details.</p>
            <br/>
            <p style="font-size: 12px; color: #64748b;">Thank you for choosing K.G SUPER Marketplace.</p>
          </div>
        `
      });
    }

    res.json({
      success: true,
      message: emailSent ? "Status updated and seller notified" : "Status updated (Email failed)",
      product,
    });
  } catch (err) {
    console.error("PATCH Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- DELETE product ----------------
router.delete("/:id", async (req, res) => {
  try {
    const product = await SellerRequestProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    if (product.images?.length) {
      for (const img of product.images) {
        if (img.publicId) {
          try { await cloudinary.uploader.destroy(img.publicId); } 
          catch (err) { console.error("Cloudinary delete failed:", err.message); }
        }
      }
    }

    await SellerRequestProduct.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product and images deleted" });
  } catch (err) {
    console.error("DELETE Error:", err);
    res.status(500).json({ success: false, message: "Delete failed: " + err.message });
  }
});

export default router;