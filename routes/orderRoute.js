import express from "express";
import authSeller from "../middlewares/authSeller.js";
import authUser from "../middlewares/authUser.js";
import Order from "../models/Order.js";
import { BrevoClient } from "@getbrevo/brevo";
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

/* =========================
   Brevo/Sib API Setup
========================= */
// Initialize Brevo client
const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY
});

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
   EMAIL RECEIPT (Sellers)
========================= */
/* =========================
   EMAIL RECEIPT (Sellers) via Brevo
========================= */
orderRouter.post("/send-receipt", authSeller, async (req, res) => {
  const { email, pdfData, fileName } = req.body;

  if (!email || !pdfData) {
    return res.status(400).json({ success: false, message: "Missing email or PDF data" });
  }

  const emailData = {
    sender: { email: process.env.BREVO_USER },
    to: [{ email }],
    subject: "Your Order Receipt",
    textContent: "Please find your attached order receipt.",
    attachment: [
      {
        content: pdfData,
        name: fileName || "receipt.pdf",
        type: "application/pdf",
      },
    ],
  };

  try {
    await brevo.transactionalEmails.sendTransacEmail(emailData);
    res.json({ success: true, message: "Email sent successfully via Brevo!" });
  } catch (error) {
    console.error("Brevo Email Error:", error);
    res.status(500).json({ success: false, message: "Failed to send email" });
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