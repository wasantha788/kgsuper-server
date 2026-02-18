import express from "express";
import authDelivery from "../middlewares/authDelivery.js";
import {getTopDeliveryBoys}  from "../controllers/analyticsController.js";
import OrderHistory from "../models/OrderHistory.js";
import Order from "../models/Order.js";



import {
  registerDeliveryBoy,
  loginDeliveryBoy,
  acceptOrder,
  cancelOrderByDelivery,
  getMyOrders,
  updateOrderStatusByDelivery,
  markDelivered,
  sendPaymentOTP,
  verifyPaymentOTP 
  
} from "../controllers/deliveryController.js";

const router = express.Router();

/* =========================
   AUTH
========================= */
router.post("/register", registerDeliveryBoy);
router.post("/login", loginDeliveryBoy);

router.get("/is-auth", authDelivery, (req, res) => {
  const deliveryBoy = req.deliveryBoy;
  res.json({
    success: true,
    user: {
      _id: deliveryBoy._id,
      name: deliveryBoy.name,
      email: deliveryBoy.email,
      role: deliveryBoy.role,
      isAvailable: deliveryBoy.isAvailable,
      activeOrders: deliveryBoy.activeOrders,
    },
  });
});

router.post("/logout", authDelivery, (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});


router.get("/my-orders", authDelivery, getMyOrders);

// Order Status Management
router.put("/cancel", authDelivery, cancelOrderByDelivery);
router.put("/accept/:orderId", authDelivery, acceptOrder);
router.put("/delivered/:orderId", authDelivery, markDelivered);
router.put("/order/:orderId/status", authDelivery, updateOrderStatusByDelivery);


router.post('/order/:orderId/send-payment-otp', authDelivery,sendPaymentOTP);

router.post("/order/:orderId/verify-payment-otp", authDelivery, verifyPaymentOTP);



router.get('/top-delivery-boys', authDelivery,getTopDeliveryBoys);


router.get("/order-history", authDelivery, async (req, res) => {
  try {
    const deliveryBoyId = req.deliveryBoy._id;

  
    const dailyStats = await OrderHistory.aggregate([
      {
        $match: {
          deliveryBoy: deliveryBoyId,
          action: "delivered",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$deliveredAt" },
          },
          totalDelivered: { $sum: 1 },
          earnings: { $sum: "$totalAmount" },
          orders: { $push: "$orderId" }, 
        },
      },
      { $sort: { "_id": 1 } }, // ascending by date
    ]);


    const populatedStats = await Promise.all(
      dailyStats.map(async (day) => {
        const ordersWithDetails = await Order.find({ _id: { $in: day.orders } })
          .populate("items.product")
          .populate("address")
          .populate("assignedDeliveryBoy", "name phone vehicleType");

        return {
          day: day._id,
          totalDelivered: day.totalDelivered,
          earnings: day.earnings,
          orders: ordersWithDetails,
        };
      })
    );

    res.json({
      success: true,
      dailyStats: populatedStats, // ready to use in charts
    });
  } catch (err) {
    console.error("Order history fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order history",
    });
  }
});


// ================= GET Single Order =================
router.get("/:id", authDelivery, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("assignedDeliveryBoy", "name phone vehicleType")
      .populate("items.product")
      .populate("address");

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// ================= UPDATE ORDER STATUS =================
router.put("/status/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // validate status
  const STATUS_OPTIONS = [
    "Order Placed",
    "Processing",
    "Packing",
    "Out for delivery",
    "Delivered",
    "Cancelled",
  ];
  if (!STATUS_OPTIONS.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate("deliveryBoy", "name email phone");

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



  


router.put(
  "/order/:id/mark-paid",
  authDelivery,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id);

      if (!order)
        return res.status(404).json({ message: "Order not found" });

      if (!order.otpVerified)
        return res.status(403).json({ message: "OTP not verified" });

      if (order.isPaid)
        return res.status(400).json({ message: "Already paid" });

      order.isPaid = true;
      await order.save();

      res.json({ message: "Payment marked as PAID", order });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);


export default router;