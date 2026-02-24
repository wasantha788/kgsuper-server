import express from "express";
import fs from "fs"; // Added for file cleanup
import authSeller from "../middlewares/authSeller.js";
import authUser from "../middlewares/authUser.js";
import Order from "../models/Order.js";
import User from "../models/user.js"; 
import { generateInvoice } from "../utils/generateInvoice.js";
import { sendReceiptEmail } from "../utils/sendReceipt.js";

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
   PLACEMENT (Customers)
========================= */
orderRouter.post("/cod", authUser, placeOrderCOD);
orderRouter.post("/stripe", authUser, placeOrderStripe);

/* =========================
   MANAGEMENT (Sellers)
========================= */
orderRouter.get("/seller", authSeller, getAllOrders);
orderRouter.put("/status/:orderId", authSeller, updateOrderStatusByAdmin);
orderRouter.delete("/delete/:orderId", authSeller, deleteOrder);

/* =========================
   USER ACTIONS (Customers)
========================= */
orderRouter.get("/user", authUser, getUserOrders);
orderRouter.put("/cancel/:orderId", authUser, cancelOrderByUser);
orderRouter.post("/assign", assignDeliveryBoy);

// Customer updates chat status
orderRouter.put("/:id/chat-status", authUser, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "Status is required" });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (req.user.id.toString() !== order.user.toString())
      return res.status(403).json({ success: false, message: "Not allowed" });

    order.chatStatus = status;
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================
   EMAIL RECEIPT (Sellers) via Resend
========================= */
orderRouter.post("/send-receipt", authSeller, async (req, res) => {
  let invoicePath = null;
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    // 1. Fetch data from Database
    const order = await Order.findById(orderId).populate("items.productId");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Use order.userId or order.user depending on your Schema
    const userId = order.userId || order.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2. Generate the PDF file
    invoicePath = await generateInvoice(order, user);

    // 3. Send the Email using the path
    await sendReceiptEmail(user.email, invoicePath);

    // 4. Cleanup: Delete the file after sending to save disk space
    if (fs.existsSync(invoicePath)) {
        fs.unlinkSync(invoicePath);
    }

    res.status(200).json({
      success: true,
      message: "Invoice generated and email sent successfully!",
    });

  } catch (error) {
    console.error("❌ Receipt Error:", error);
    
    // Attempt cleanup even if sending failed
    if (invoicePath && fs.existsSync(invoicePath)) {
        fs.unlinkSync(invoicePath);
    }

    res.status(500).json({
      success: false,
      message: "Failed to process receipt",
      error: error.message,
    });
  }
});

/* =========================
   GENERAL (Both User & Seller)
========================= */
orderRouter.get("/:orderId", (req, res, next) => {
    if (req.headers.seller_token) return authSeller(req, res, next);
    return authUser(req, res, next);
}, getOrderById);

export default orderRouter;