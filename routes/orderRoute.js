import express from "express";
import fs from "fs"; // Added for file cleanup
import authSeller from "../middlewares/authSeller.js";
import authUser from "../middlewares/authUser.js";
import Order from "../models/Order.js";
import User from "../models/user.js"; 
import { generateInvoice } from "../utils/generateInvoice.js";
import { sendReceiptEmail } from "../utils/sendReceipt.js";
import SibApiV3Sdk from "sib-api-v3-sdk";
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


const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();
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
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });

    const order = await Order.findById(orderId).populate("items.product");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const userId = order.userId || order.user;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // 1️⃣ Generate PDF
    invoicePath = await generateInvoice(order, user);

    // 2️⃣ Send email
    await sendReceiptEmail(user.email, invoicePath);

    // 3️⃣ Cleanup
    if (fs.existsSync(invoicePath)) fs.unlinkSync(invoicePath);

    res.status(200).json({ success: true, message: "Invoice sent successfully!" });
  } catch (err) {
    console.error("❌ Receipt Error:", err);
    if (invoicePath && fs.existsSync(invoicePath)) setTimeout(() => fs.unlinkSync(invoicePath), 5000);
    res.status(500).json({ success: false, message: "Failed to send receipt", error: err.message });
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