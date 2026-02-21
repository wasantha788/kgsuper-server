import DeliveryBoy from "../models/DeliveryBoy.js";
import Order from "../models/Order.js";
import OrderHistory from "../models/OrderHistory.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/* =========================
   JWT TOKEN GENERATOR
========================= */
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || "secretkey", {
    expiresIn: "7d",
  });

/* =========================
   EMAIL TRANSPORTER
========================= */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT), // 587
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

/* =========================
   SAVE ORDER HISTORY
========================= */
const saveOrderHistory = async ({
  orderId,
  deliveryBoyId,
  action,
  status,
  note = "",
}) => {
  try {
    await OrderHistory.create({
      orderId,
      deliveryBoy: deliveryBoyId,
      action,
      status,
      note,
    });
  } catch (err) {
    console.error("Order history save failed:", err.message);
  }
};

/* =========================
   REGISTER DELIVERY BOY
========================= */
export const registerDeliveryBoy = async (req, res) => {
  try {
    const { name, email, password, phone, vehicleType } = req.body;

    const exists = await DeliveryBoy.findOne({ email });
    if (exists)
      return res.status(400).json({ success: false, message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const deliveryBoy = await DeliveryBoy.create({
      name,
      email,
      password: hashedPassword,
      phone: phone || "",
      vehicleType: vehicleType || "",
    });

    res.json({
      success: true,
      token: generateToken(deliveryBoy._id),
      user: {
        _id: deliveryBoy._id,
        name,
        email,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   LOGIN DELIVERY BOY
========================= */
export const loginDeliveryBoy = async (req, res) => {
  try {
    const { email, password } = req.body;

    const deliveryBoy = await DeliveryBoy.findOne({ email });
    if (!deliveryBoy)
      return res.status(400).json({ success: false, message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, deliveryBoy.password);
    if (!isMatch)
      return res.status(400).json({ success: false, message: "Invalid email or password" });

    res.json({
      success: true,
      token: generateToken(deliveryBoy._id),
      user: {
        _id: deliveryBoy._id,
        name: deliveryBoy.name,
        email: deliveryBoy.email,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   GET MY ORDERS
========================= */
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      assignedDeliveryBoy: req.deliveryBoy._id,
      status: { $ne: "Cancelled" },
    })
      .populate("assignedDeliveryBoy", "name phone vehicleType")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load orders" });
  }
};

/* =========================
   ACCEPT ORDER
========================= */
export const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    if (order.assignedDeliveryBoy)
      return res.status(400).json({ success: false, message: "Already assigned" });

    order.assignedDeliveryBoy = req.deliveryBoy._id;
    order.status = "Out for delivery";
    await order.save();

    await saveOrderHistory({
      orderId: order._id,
      deliveryBoyId: req.deliveryBoy._id,
      action: "Accepted Order",
      status: order.status,
    });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================
   CANCEL ORDER
========================= */
export const cancelOrderByDelivery = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      assignedDeliveryBoy: req.deliveryBoy._id,
    });

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found or unauthorized" });

    order.assignedDeliveryBoy = null;
    order.status = "Order Placed";
    await order.save();

    await saveOrderHistory({
      orderId: order._id,
      deliveryBoyId: req.deliveryBoy._id,
      action: "Order Cancelled",
      status: order.status,
    });

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================
   SEND PAYMENT OTP
========================= */
export const sendPaymentOTP = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      _id: orderId,
      assignedDeliveryBoy: req.deliveryBoy._id,
    }).populate("user");

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found or unauthorized" });

    if (order.isPaid)
      return res.status(400).json({ success: false, message: "Order already paid" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    order.paymentOTP = hashedOTP;
    order.paymentOTPExpire = Date.now() + 5 * 60 * 1000;
    await order.save();

    await transporter.sendMail({
      from: `"k.G SUPER🔰" <${process.env.EMAIL_USER}>`,
      to: order.user.email,
      subject: "Payment Confirmation OTP",
      html: `
        <div style="text-align:center;">
          <h2>Your Payment OTP</h2>
          <h1>${otp}</h1>
          <p>Valid for 5 minutes</p>
        </div>
      `,
    });

    await saveOrderHistory({
      orderId: order._id,
      deliveryBoyId: req.deliveryBoy._id,
      action: "OTP Sent",
      status: order.status,
    });

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   VERIFY PAYMENT OTP
========================= */
export const verifyPaymentOTP = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      assignedDeliveryBoy: req.deliveryBoy._id,
    });

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found or unauthorized" });

    if (order.isPaid)
      return res.status(400).json({ success: false, message: "Already paid" });

    if (!order.paymentOTP || order.paymentOTPExpire < Date.now())
      return res.status(400).json({ success: false, message: "OTP expired or not generated" });

    const hashedOTP = crypto.createHash("sha256").update(otp.toString()).digest("hex");

    if (hashedOTP !== order.paymentOTP)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    order.isPaid = true;
    order.status = "Delivered";
    order.paymentOTP = undefined;
    order.paymentOTPExpire = undefined;

    await order.save();

    await DeliveryBoy.findByIdAndUpdate(req.deliveryBoy._id, {
      $inc: { totalDelivered: 1 },
      isAvailable: true,
    });

    await saveOrderHistory({
      orderId: order._id,
      deliveryBoyId: req.deliveryBoy._id,
      action: "Payment Verified",
      status: order.status,
    });

    res.json({ success: true, message: "Payment confirmed & order delivered" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


/* =========================
   MARK ORDER AS DELIVERED
========================= */
export const markDelivered = async (req, res) => {
  try {
    const deliveryBoyId = req.deliveryBoy._id;
    const { orderId } = req.params;

    const order = await Order.findOne({
      _id: orderId,
      assignedDeliveryBoy: deliveryBoyId,
    });
    if (!order)
      return res.status(404).json({
        success: false,
        message: "Order not found or not assigned to you",
      });

    if (order.status === "Delivered")
      return res.json({ success: false, message: "Order already delivered" });

    order.status = "Delivered";
    order.isPaid = order.paymentType === "COD" ? false : true;
    await order.save();

    await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
      $inc: { totalDelivered: 1 },
      isAvailable: true,
    });

    // Emit update
    req.app.get("io").to("sellerRoom").emit("orderDelivered", order);

    res.json({ success: true, message: "Order delivered", order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



