import DeliveryBoy from "../models/DeliveryBoy.js";
import Order from "../models/Order.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import OrderHistory from "../models/OrderHistory.js";
import crypto from "crypto";
import SibApiV3Sdk from "sib-api-v3-sdk";


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
   BREVO API CONFIG (NO SMTP)
========================= */
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey =
  process.env.BREVO_API_KEY;

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();


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
    req.app.get("io").to("sellerRoom").emit("orderUpdated", {
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
export const orderUpdated = async (req, res) => {
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
     /* =========================
   SEND PAYMENT OTP (BREVO API)
========================= */
export const sendPaymentOTP = async (req, res) => {
  try {
    const { orderId } = req.params;
    const deliveryBoyId = req.deliveryBoy._id;

    const order = await Order.findOne({
      _id: orderId,
      assignedDeliveryBoy: deliveryBoyId,
    }).populate("user");

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    const customerEmail = order.user?.email;
    if (!customerEmail)
      return res.status(400).json({ success: false, message: "Customer has no email" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    order.paymentOTP = otpHash;
    order.paymentOTPExpire = Date.now() + 5 * 60 * 1000;
    await order.save();

    await emailApi.sendTransacEmail({
      sender: {
        email: process.env.BREVO_USER,
        name: "KGSUPER🔰",
      },
      to: [
        {
          email: customerEmail,
          name: order.user?.name || "Customer",
        },
      ],
      subject: "Your Payment OTP",
      htmlContent: `
        <div style="font-family: Arial;">
          <h2>Payment Verification</h2>
          <p>Hello ${order.user?.name || "Customer"},</p>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>This code is valid for 5 minutes.</p>
        </div>
      `,
    });

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("❌ sendPaymentOTP error:", err);
    res.status(500).json({ success: false, message: "Failed to send OTP email" });
  }
};

/* =========================
   VERIFY PAYMENT OTP
========================= */
export const verifyPaymentOTP = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const deliveryBoyId = req.deliveryBoy?._id;
    if (!deliveryBoyId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const order = await Order.findOne({
      _id: orderId,
      assignedDeliveryBoy: deliveryBoyId,
    });

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    if (!order.paymentOTP || order.paymentOTPExpire < Date.now())
      return res.status(400).json({ success: false, message: "OTP expired" });

    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedOTP !== order.paymentOTP)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    order.isPaid = true;
    order.status = "Delivered";
    order.paymentOTP = undefined;
    order.paymentOTPExpire = undefined;
    await order.save();

    await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
      $inc: { totalDelivered: 1 },
      isAvailable: true,
    });

    await OrderHistory.create({
      orderId: order._id,
      deliveryBoy: deliveryBoyId,
      action: "Delivered",
      status: order.status,
    });

    res.json({ success: true, message: "Payment confirmed & delivered" });
  } catch (err) {
    console.error("❌ verifyPaymentOTP error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};