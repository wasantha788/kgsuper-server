import express from "express";
import authSeller from "../middlewares/authSeller.js";
import authUser from "../middlewares/authUser.js";
import Order from "../models/Order.js";
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

/* =========================
   Brevo/Sib API Setup
========================= */
// Initialize Brevo client

// 1️⃣ Configure API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY; // Your API key


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
   EMAIL RECEIPT (Sellers) via Brevo
========================= */
       orderRouter.post("/send-receipt", authSeller, async (req, res) => {
  try {
    const { email, name, pdfData, fileName } = req.body;

    // Validate input
    if (!email || !pdfData) {
      return res.status(400).json({
        success: false,
        message: "Recipient email and PDF data are required",
      });
    }

    // Remove data prefix if exists
    const cleanPdfBase64 = pdfData.replace(/^data:application\/pdf;base64,/, "");

    // Prepare payload for Resend API
    const payload = {
      from: "kgsupershop@gmail.com", // must be verified in Resend
      to: email,
      subject: "Your Order Invoice",
      html: `<h1>Hello ${name || "Customer"},</h1><p>Here is your order invoice.</p>`,
      attachments: [
        {
          type: "application/pdf",
          name: fileName || "invoice.pdf",
          data: cleanPdfBase64,
        },
      ],
    };

    // Send email via Resend
    const response = await axios.post(
      "https://api.resend.com/emails",
      payload,
      {
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Email sent via Resend:", response.data);

    res.status(200).json({
      success: true,
      message: "Receipt sent successfully",
      result: response.data,
    });
  } catch (error) {
    console.error("❌ Error sending receipt via Resend:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to send receipt",
      error: error.response?.data || error.message,
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