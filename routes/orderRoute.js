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

dotenv.config();
const orderRouter = express.Router();

// --- Brevo Configuration ---
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

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
orderRouter.post("/assign", authSeller, assignDeliveryBoy); // Added authSeller for security

/* =========================
   USER ACTIONS (Customers)
========================= */
orderRouter.get("/user", authUser, getUserOrders);
orderRouter.put("/cancel/:orderId", authUser, cancelOrderByUser);

// Customer updates chat status
orderRouter.put("/:id/chat-status", authUser, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "Status is required" });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Ensure the user updating the status actually owns the order
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

/* =========================
   EMAIL RECEIPT (Sellers)
========================= */
orderRouter.post("/send-receipt", authSeller, async (req, res) => {
  let invoicePath = null;

  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });

    const order = await Order.findById(orderId).populate("items.product");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const userId = order.userId || order.user;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "Recipient user not found" });

    // Generate PDF invoice
    invoicePath = await generateInvoice(order, user);

    // Send email
    const emailSent = await sendReceiptEmail(user.email, invoicePath);

    if (!emailSent) throw new Error("Email provider failed to send");

    res.status(200).json({ success: true, message: "Receipt sent successfully!" });
  } catch (err) {
    console.error("Receipt Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    // Always cleanup file if it exists, whether success or failure
    if (invoicePath && fs.existsSync(invoicePath)) {
      fs.unlinkSync(invoicePath);
    }
  }
});

/* =========================
   GENERAL (Shared)
========================= */
orderRouter.get("/:orderId", (req, res, next) => {
    // If it's a seller token, use seller auth, otherwise use user auth
    if (req.headers.token || req.headers.seller_token) {
        const authMethod = req.headers.seller_token ? authSeller : authUser;
        return authMethod(req, res, next);
    }
    return res.status(401).json({ success: false, message: "Authentication required" });
}, getOrderById);

export default orderRouter;