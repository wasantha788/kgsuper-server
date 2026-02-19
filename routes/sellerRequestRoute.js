import express from "express";
import multer from "multer";
import SellerRequestProduct from "../models/sellerRequestProduct.js";
import fs from "fs";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* =====================================================
   CHECK ENV VARIABLES
===================================================== */

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("❌ EMAIL_USER or EMAIL_PASS missing in .env file");
}

/* =====================================================
   MULTER CONFIG
===================================================== */

const uploadDir = "uploads/";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* =====================================================
   EMAIL TRANSPORTER (SAFE VERSION)
===================================================== */

const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/* =====================================================
   GET ALL REQUESTS
===================================================== */

router.get("/", async (req, res) => {
  try {
    const products = await SellerRequestProduct.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    console.error("GET Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =====================================================
   CREATE SELLER REQUEST
===================================================== */

router.post("/products", upload.array("images", 4), async (req, res) => {
  try {
    const imagePaths = req.files ? req.files.map(f => f.path) : [];

    const newProduct = new SellerRequestProduct({
      ...req.body,
      price: Number(req.body.price),
      quantity: Number(req.body.quantity),
      images: imagePaths,
      status: "pending",
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: "Product sent for admin approval!",
    });

  } catch (err) {
    console.error("Submission Error:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

/* =====================================================
   UPDATE STATUS + SEND EMAIL (PROPER FIX)
===================================================== */

router.patch("/update-status/:id", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const product = await SellerRequestProduct.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let emailSent = false;

    if (product.sellerEmail) {
      try {
        const transporter = createTransporter();

        const info = await transporter.sendMail({
          from: `"K.G SUPER Marketplace" <${process.env.EMAIL_USER}>`,
          to: product.sellerEmail,
          subject: `Your Product Has Been ${status.toUpperCase()}`,
          html: `
            <h2>Hello ${product.sellerName || "Seller"},</h2>
            <p>Your product "<strong>${product.name}</strong>" 
            has been <strong>${status.toUpperCase()}</strong>.</p>
            <br/>
            <p>Thank you for using K.G SUPER Marketplace.</p>
          `,
        });

        console.log("✅ Email sent:", info.response);
        emailSent = true;

      } catch (emailError) {
        console.error("❌ EMAIL FAILED:", emailError.message);
      }
    } else {
      console.log("⚠ No seller email provided");
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
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/* =====================================================
   DELETE PRODUCT
===================================================== */

router.delete("/:id", async (req, res) => {
  try {
    const product = await SellerRequestProduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.images?.length) {
      product.images.forEach(path => {
        if (fs.existsSync(path)) {
          fs.unlinkSync(path);
        }
      });
    }

    await SellerRequestProduct.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Product deleted successfully",
    });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// Example Express Route
router.get("/products", async (req, res) => {
  try {
    // Only fetch products where status is 'pending' (or all if you prefer)
    const products = await Product.find({ status: "pending" }); 
    res.status(200).json({ products });
  } catch (error) {
    res.status(500).json({ message: "Error fetching products" });
  }
});

export default router;
