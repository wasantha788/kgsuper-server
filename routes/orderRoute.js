import express from "express";
import authSeller from "../middlewares/authSeller.js";
import authUser from "../middlewares/authUser.js";
import Order from "../models/Order.js";
import SibApiV3Sdk from "sib-api-v3-sdk";
import fs from "fs";
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

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
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
    const { orderId, recipientEmail, recipientName } = req.body;

    if (!orderId || !recipientEmail)
      return res.status(400).json({ success: false, message: "Order ID and recipient email are required" });

    // Optional: generate PDF dynamically instead of static file
    const pdfData = fs.readFileSync("./invoice.pdf"); // path to your PDF
    const pdfBase64 = pdfData.toString("base64");

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
      to: [{ email: recipientEmail, name: recipientName || "Customer" }],
      sender: { email: "kgsupershop@gmail.com", name: "kg super" },
      subject: "Your Invoice PDF",
      htmlContent: "<h1>Here is your invoice</h1><p>See attached PDF.</p>",
      attachment: [
        {
          content: pdfBase64,
          name: "invoice.pdf",
        },
      ],
    });

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Email sent successfully:", result);

    res.status(200).json({ success: true, message: "Receipt sent successfully", result });
  } catch (err) {
    console.error("❌ Error sending receipt email:", err);
    res.status(500).json({ success: false, message: "Failed to send receipt" });
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