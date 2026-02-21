import DeliveryBoy from "../models/DeliveryBoy.js";
import Order from "../models/Order.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import OrderHistory from "../models/OrderHistory.js";
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

  // Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "kgsupershop@gmail.com", // your email from .env
    pass: "nwmtkerqgbsgaeyf", // your email password from .env
  },
});

/* =========================
   REGISTER DELIVERY BOY
========================= */
export const registerDeliveryBoy = async (req, res) => {
  try {
    const { name, email, password, phone, vehicleType } = req.body;

    // Check if email already exists
    const exists = await DeliveryBoy.findOne({ email });
    if (exists)
      return res.json({ success: false, message: "Email already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create delivery boy with optional phone and vehicleType
    const deliveryBoy = await DeliveryBoy.create({
      name,
      email,
      password: hashedPassword,
      phone: phone || "",           // optional
      vehicleType: vehicleType || "", // optional
    });

    res.json({
      success: true,
      token: generateToken(deliveryBoy._id),
      user: {
        _id: deliveryBoy._id,
        name: deliveryBoy.name,
        email: deliveryBoy.email,
        role: deliveryBoy.role,
        isAvailable: deliveryBoy.isAvailable,
        phone: deliveryBoy.phone,
        vehicleType: deliveryBoy.vehicleType,
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
      return res.json({ success: false, message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, deliveryBoy.password);
    if (!isMatch)
      return res.json({ success: false, message: "Invalid email or password" });

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
   GET DELIVERY BOY ORDERS (MY ORDERS)
========================= */

export const getMyOrders = async (req, res) => {
  try {
    const deliveryBoyId = req.deliveryBoy._id;

    const orders = await Order.find({
      assignedDeliveryBoy: deliveryBoyId,
    })
      .populate("assignedDeliveryBoy", "name phone vehicleType")
      .sort({ createdAt: -1 });

    // ✅ ALWAYS respond
    return res.status(200).json({
      success: true,
      orders: orders || [],
    });
  } catch (err) {
    console.error("getMyOrders error:", err);
    return res.status(500).json({
      success: false,
      orders: [],
      message: "Failed to load orders",
    });
  }
};

/* =========================
   ACCEPT ORDER
========================= */
export const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const deliveryBoyId = req.deliveryBoy._id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.assignedDeliveryBoy) {
      return res.status(400).json({
        success: false,
        message: "Order already assigned",
      });
    }

    // Assign delivery boy
    order.assignedDeliveryBoy = deliveryBoyId;
    order.status = "Out for delivery";
    await order.save();

    // Populate delivery boy ONCE
    await order.populate("assignedDeliveryBoy", "name phone vehicleType");

    // Emit to seller dashboard
    req.app.get("io").to("sellerRoom").emit("orderAcceptedByDelivery", {
      orderId: order._id,
      deliveryBoy: order.assignedDeliveryBoy,
      status: order.status,
    });

    return res.json({
      success: true,
      order,
    });
  } catch (err) {
    console.error("Accept order error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* =========================
   REJECT ORDER
========================= */
export const rejectOrderByDelivery = async (req, res) => {
  try {
    const { orderId } = req.body;
    const deliveryBoyId = req.deliveryBoy._id;

    const order = await Order.findById(orderId);
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    // Make order available for other delivery boys
    order.assignedDeliveryBoy = null;
    order.status = "Order Placed";
    await order.save();

    // Notify all delivery boys
    req.app.get("io").to("deliveryRoom").emit("newDeliveryOrder", order);

    res.json({ success: true, message: "Order rejected successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================
   CANCEL ORDER BY DELIVERY
========================= */
export const cancelOrderByDelivery = async (req, res) => {
  try {
    const { orderId } = req.body;
    const deliveryBoyId = req.deliveryBoy._id;

    const order = await Order.findById(orderId);
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    order.assignedDeliveryBoy = null;
    order.status = "Order Placed";
    await order.save();

    await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
      isAvailable: true,
      $pull: { activeOrders: orderId },
    });

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================
   UPDATE ORDER STATUS
========================= */
export const updateOrderStatusByDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "Order Placed",
      "Processing",
      "Packing",
      "Out for delivery",
      "Delivered",
      "Cancelled",
    ];
    if (!allowedStatuses.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    const order = await Order.findById(orderId).populate(
      "assignedDeliveryBoy",
      "name phone vehicleType"
    );
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    order.status = status;
    await order.save();

    // Cleanup delivery boy if finished
    if (["Delivered", "Cancelled"].includes(status) && order.assignedDeliveryBoy) {
      await DeliveryBoy.findByIdAndUpdate(order.assignedDeliveryBoy._id, {
        isAvailable: true,
        $pull: { activeOrders: order._id },
      });
    }

    // Emit status update
    req.app.get("io").to("sellerRoom").emit("orderUpdated", order);

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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




// controllers/deliveryController.js
export const getDeliveryOrders = async (req, res) => {
  try {
    const deliveryBoyId = req.deliveryBoy._id;

    const orders = await Order.find({
      $or: [
        { assignedDeliveryBoy: deliveryBoyId },
        { "assignedDeliveryBoy._id": deliveryBoyId }
      ],
      status: { $ne: "Cancelled" },
    })
      .populate("address")
      .populate("items.product");

    console.log("Found orders:", orders.length);

    res.json({ orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};



export const saveOrderHistory = async ({
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
    console.error("❌ Order history save failed:", err);
  }
};



export const sendPaymentOTP = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId).populate("user");
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (order.isPaid)
    return res.status(400).json({ message: "Already paid" });

  // 1️⃣ Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 2️⃣ Hash OTP
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

  // 3️⃣ Save OTP to order
  order.paymentOTP = hashedOTP;
  order.paymentOTPExpire = Date.now() + 5 * 60 * 1000; // 5 mins
  await order.save();

  // 4️⃣ Send email
  await transporter.sendMail({
    from: `"k.G SUPER🔰" <${process.env.EMAIL_USER}>`,
    to: order.user.email,
    subject: "Payment Confirmation OTP",
    html: `
      <h2>Your Payment OTP</h2>
      <h1>${otp}</h1>
      <p>Give this OTP to the delivery boy.</p>
      <p>Valid for 5 minutes.</p>
    `,
  });

  res.json({ message: "OTP sent to customer email" });
};




export const verifyPaymentOTP = async (req, res) => {
  const { orderId } = req.params;
  const { otp } = req.body;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (!order.paymentOTP)
    return res.status(400).json({ message: "OTP not generated" });

  if (order.paymentOTPExpire < Date.now())
    return res.status(400).json({ message: "OTP expired" });

  const hashedOTP = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  if (hashedOTP !== order.paymentOTP)
    return res.status(400).json({ message: "Invalid OTP" });

  // ✅ SUCCESS
  order.isPaid = true;
  order.paymentOTP = undefined;
  order.paymentOTPExpire = undefined;

  await order.save();

  res.json({ message: "Payment confirmed successfully" });
};


