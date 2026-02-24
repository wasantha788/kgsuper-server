import express from "express";
import authSeller from "../middlewares/authSeller.js";
import authUser from "../middlewares/authUser.js";
import Order from "../models/Order.js";
import { Resend } from 'resend';

import {
  cancelOrderByUser,
  getAllOrders,
  getUserOrders,
  placeOrderCOD,
  placeOrderStripe,
  getOrderById,
  updateOrderStatusByAdmin,
  deleteOrder,
  assignDeliveryBoy
} from "../controllers/orderControler.js";
import dotenv from "dotenv";
dotenv.config();


const orderRouter = express.Router();

/* =========================
   Brevo/Sib API Setup
========================= */
// Initialize Brevo client

// 1️⃣ Configure API client
const resend = new Resend(process.env.RESEND_API_KEY);


/* =========================
   PLACEMENT (Customers)
========================= */
orderRouter.post("/cod", authUser, placeOrderCOD);
orderRouter.post("/stripe", authUser, placeOrderStripe);

/* =========================
   MANAGEMENT (Sellers)
========================= */
// This is for the Seller Dashboard list
orderRouter.get("/seller", authSeller, getAllOrders);
orderRouter.put("/status/:orderId", authSeller, updateOrderStatusByAdmin);
orderRouter.delete("/delete/:orderId", authSeller, deleteOrder);

/* =========================
   USER ACTIONS (Customers)
========================= */
orderRouter.get("/user", authUser, getUserOrders);
orderRouter.put("/cancel/:orderId", authUser, cancelOrderByUser);





orderRouter.post("/assign",  assignDeliveryBoy);



// Customer updates chat status
orderRouter.put("/:id/chat-status", authUser, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "Status is required" });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Use req.user.id instead of req.user._id
    if (req.user.id.toString() !== order.user.toString())
      return res.status(403).json({ success: false, message: "Not allowed" });

    order.chatStatus = status;
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    console.log("Chat Status Update Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


/* =========================
   EMAIL RECEIPT (Sellers) via Resend
========================= */
orderRouter.post("/send-receipt", authSeller, async (req, res) => {
  try {
    // 1. Added orderId to the destructuring so we can tag the email
    const { email, name, pdfData, fileName, orderId } = req.body;

    if (!email || !pdfData) {
      return res.status(400).json({
        success: false,
        message: "Recipient email and PDF data are required",
      });
    }

    const cleanPdfBase64 = pdfData.replace(/^data:application\/pdf;base64,/, "");

    const { data, error } = await resend.emails.send({
      // ⚠️ IMPORTANT: Changed from Gmail to Resend's testing address
      from: 'KG Super Shop <onboarding@resend.dev>', 
      to: [email],
      subject: 'Your Order Invoice',
      html: `<h1>Hello ${name || "Customer"},</h1><p>Thank you for your order! Please find your invoice attached.</p>`,
      attachments: [
        {
          filename: fileName || 'invoice.pdf',
          content: cleanPdfBase64,
        },
      ],
      // 2. Added tags so the Webhook knows which order this belongs to
      tags: [
        {
          name: 'category',
          value: 'order_receipt',
        },
        {
          name: 'order_id',
          value: orderId || 'unknown',
        },
      ],
    });

    if (error) {
      // Resend errors often have a message and a name
      console.error("Resend API Error Detail:", error);
      return res.status(400).json({ success: false, message: error.message });
    }

    console.log("✅ Email sent via Resend. ID:", data.id);

    res.status(200).json({
      success: true,
      message: "Receipt sent successfully",
      id: data.id,
    });
    
  } catch (error) {
    console.error("❌ Server Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});
/* =========================
   GENERAL (Both User & Seller)
========================= */
// Fixed: Both User and Seller need to be able to view a single order
orderRouter.get("/:orderId", (req, res, next) => {
    // Logic to allow if it's a seller OR the user who owns the order
    // For now, checking if either token is present:
    if (req.headers.seller_token) return authSeller(req, res, next);
    return authUser(req, res, next);
}, getOrderById);


export default orderRouter;