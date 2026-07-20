import express from "express";
import fs from "fs";
import dotenv from "dotenv";
import SibApiV3Sdk from "sib-api-v3-sdk";

// Middlewares
import authSeller from "../middlewares/authSeller.js";
import authUser from "../middlewares/authUser.js";

// Models
import Order from "../models/Order.js";
import User from "../models/user.js"; 

// Utils & Controllers
import {getSellerOrders} from "../controllers/seller-controller.js";
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

const orderRouter = express.Router();

// --- Brevo Configuration ---
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

/* =========================
   PLACEMENT & STATIC ROUTES (Evaluated First)
========================= */
orderRouter.post("/cod", authUser, placeOrderCOD);
orderRouter.post("/stripe", authUser, placeOrderStripe);

// Move static customer routes up
orderRouter.get("/my-orders/all", authUser, getUserOrders);

// Move static seller routes up
orderRouter.get("/seller", authSeller, getSellerOrders);
orderRouter.put("/status/:orderId", authSeller, updateOrderStatusByAdmin);
orderRouter.delete("/delete/:orderId", authSeller, deleteOrder);
orderRouter.post("/assign", authSeller, assignDeliveryBoy); 

/* =========================
   EMAIL RECEIPT & USER CANCEL (Static/Specific paths)
========================= */
orderRouter.put("/cancel/:orderId", authUser, cancelOrderByUser);

orderRouter.post("/send-receipt", authSeller, async (req, res) => {
  try {
    const { orderId, email, pdfData, fileName } = req.body;
    
    if (!orderId || !email || !pdfData) {
      return res.status(400).json({ 
        success: false, 
        message: "Order ID, email, and PDF data are required." 
      });
    }

    const pdfBuffer = Buffer.from(pdfData, "base64");

    await sendReceiptEmail(email, {
      content: pdfBuffer,
      filename: fileName || `Receipt_${orderId}.pdf`,
    });

    res.status(200).json({ success: true, message: "Receipt emailed successfully!" });
  } catch (err) {
    console.error("Receipt Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================
   DYNAMIC PARAMETER ROUTES (Evaluated Last)
========================= */
// ⚡ FIX: Placed below static endpoints so it won't intercept "/seller"
orderRouter.get("/:orderId", authUser, getOrderById);

// Customer updates chat status
orderRouter.put("/:id/chat-status", authUser, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "Status is required" });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (req.user.id.toString() !== order.userId?.toString() && req.user.id.toString() !== order.user?.toString()) {
        return res.status(403).json({ success: false, message: "Not authorized to update this order" });
    }

    order.chatStatus = status;
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

export default orderRouter;