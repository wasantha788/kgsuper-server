import Order from "../models/Order.js";
import Product from "../models/product.js";
import User from "../models/user.js";
import Stripe from "stripe";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { generateInvoice } from "../utils/generateInvoice.js";
import { sendReceiptEmail } from "../utils/sendReceipt.js";

// ------------------------
// PLACE ORDER - COD
// ------------------------
export const placeOrderCOD = async (req, res) => {
  try {
    const { items, address, chatEnabled, locationEnabled } = req.body;
    const userId = req.user.id;

    if (!userId || !address || !items || items.length === 0) {
      return res.json({ success: false, message: "Invalid order data" });
    }

    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.json({ success: false, message: "Product not found" });
      
      const price = product.offerPrice ?? product.price;
      subtotal += price * item.quantity;
    }

    const deliveryFee = subtotal >= 5000 ? 0 : 300;
    const finalAmount = subtotal + deliveryFee;

    const order = await Order.create({
      user: userId,
      items,
      amount: finalAmount, 
      address,
      paymentType: "COD",
      isPaid: false,
      chatEnabled: chatEnabled ?? false,
      locationEnabled: locationEnabled ?? false,
    });

    res.json({ 
      success: true, 
      message: "Order placed successfully", 
      order 
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ------------------------
// PLACE ORDER - STRIPE
// ------------------------
export const placeOrderStripe = async (req, res) => {
  try {
    const { items, address, chatEnabled, locationEnabled } = req.body;
    const userId = req.user.id;
    const { origin } = req.headers;

    if (!userId || !address || !items || items.length === 0) {
      return res.json({ success: false, message: "Invalid order data" });
    }

    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    const productData = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      // 💡 නිෂ්පාදනයක් නොමැති නම් error එකක් දීම වඩාත් ආරක්ෂිතයි (Price tampering වැළැක්වීමට)
      if (!product) return res.json({ success: false, message: `Product not found: ${item.product}` });

      const price = product.offerPrice ?? product.price;
      subtotal += price * item.quantity;

      productData.push({
        name: product.name,
        price,
        quantity: item.quantity,
      });
    }

    const deliveryFee = subtotal >= 5000 ? 0 : 300;
    const totalAmount = subtotal + deliveryFee;

    const order = await Order.create({
      user: userId,
      items,
      amount: totalAmount, 
      address,
      paymentType: "online",
      isPaid: false,
      chatEnabled: chatEnabled ?? false,
      locationEnabled: locationEnabled ?? false,
    });

    const line_items = productData.map((item) => ({
      price_data: {
        currency: "lkr",
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100), 
      },
      quantity: item.quantity,
    }));

    if (deliveryFee > 0) {
      line_items.push({
        price_data: {
          currency: "lkr",
          product_data: { name: "Delivery Fee" },
          unit_amount: deliveryFee * 100, 
        },
        quantity: 1,
      });
    }

    const session = await stripeInstance.checkout.sessions.create({
      line_items,
      mode: "payment",
      success_url: `${origin}/loader?next=my-orders`,
      cancel_url: `${origin}/cart`,
      metadata: { orderId: order._id.toString(), userId },
    });

    return res.json({ success: true, url: session.url });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ------------------------
// STRIPE WEBHOOK
// ------------------------
export const stripeWebhooks = async (req, res) => {
  const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;

    const sessions = await stripeInstance.checkout.sessions.list({
      payment_intent: paymentIntent.id,
    });

    if (sessions.data.length > 0) {
      const { orderId, userId } = sessions.data[0].metadata;

      const order = await Order.findByIdAndUpdate(
        orderId,
        { isPaid: true, status: "Order Placed" },
        { new: true }
      )
        .populate("items.product")
        .populate("address");

      const user = await User.findByIdAndUpdate(
        userId,
        { cartItems: {} },
        { new: true }
      );

      if (order && user) {
        try {
          const invoicePath = await generateInvoice(order, user);
          await sendReceiptEmail(user.email, invoicePath);
        } catch (emailErr) {
          console.error("Failed to send invoice email:", emailErr.message);
        }
      }
    }
  }
  
  // 💡 FIX: Stripe වෙත සාර්ථකව ලැබුණු බව දන්වා 200 Response එකක් යැවීම
  res.status(200).json({ received: true });
};

// ------------------------
// GET SINGLE ORDER BY ID
// ------------------------
// controllers/orderController.js

export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("items.product")
      .populate("assignedDeliveryBoy", "name phone vehicleType")
      .populate("address");   // ✅ Added

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // --- Dynamic Authorization Check ---
    
    if (req.seller) {
      return res.json({ success: true, order });
    }

    if (req.deliveryBoy || req.delivery) {
      const deliveryId = req.deliveryBoy?.id || req.delivery?.id;
      const isAssigned = order.assignedDeliveryBoy?._id?.toString() === deliveryId?.toString();
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: "Unauthorized: You are not the assigned rider for this order" });
      }
      return res.json({ success: true, order });
    }

    if (req.user) {
      const userId = req.user.id || req.user._id;
      const isOwner = order.user?.toString() === userId?.toString();
      if (!isOwner) {
        return res.status(403).json({ success: false, message: "Unauthorized access to this order" });
      }
      return res.json({ success: true, order });
    }

    return res.status(401).json({ success: false, message: "Authentication credentials not recognized" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ------------------------
// GET USER ORDERS
// ------------------------
// controllers/orderController.js

export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const orders = await Order.find({ user: userId })
      .populate("items.product")
      .populate("address")
      .populate("assignedDeliveryBoy", "name phone vehicleType")   // ✅ added this line
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ------------------------
// ADMIN: GET ALL ORDERS
// ------------------------
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("items.product")
      .populate("address")
      .populate("assignedDeliveryBoy", "name phone vehicleType")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ------------------------
// CANCEL ORDER (USER)
// ------------------------
export const cancelOrderByUser = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) return res.json({ success: false, message: "Order not found" });

    if (!["Order Placed", "Processing"].includes(order.status)) {
      return res.json({ success: false, message: "Order cannot be cancelled at this stage" });
    }

    order.status = "Cancelled";
    await order.save();

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ------------------------
// DELETE ORDER (ADMIN)
// ------------------------
export const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await order.deleteOne();
    res.json({ success: true, message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Delete request failed" });
  }
};

// ------------------------
// UPDATE ORDER STATUS (ADMIN / SELLER)
// ------------------------
export const updateOrderStatusByAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["Order Placed", "Processing", "Out for delivery", "Delivered", "Cancelled"];
    if (!allowedStatuses.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.status = status;
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ------------------------
// GET ALL ORDERS FOR SELLER
// ------------------------
export const getAllOrdersForSeller = async (req, res) => {
  try {
    // 💡 FIX: items.product එක populate කරන ලදී සහ response එක { success: true, orders } ලෙස සකසන ලදී.
    const orders = await Order.find()
      .populate("user", "name email")
      .populate("assignedDeliveryBoy", "name phone")
      .populate("items.product") 
      .populate("address")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, orders }); 
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ------------------------
// ASSIGN DELIVERY BOY
// ------------------------
export const assignDeliveryBoy = async (req, res) => {
  const { orderId, deliveryBoyId } = req.body;

  try {
    const order = await Order.findById(orderId);
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);

    if (!order || !deliveryBoy) {
      return res.status(404).json({ message: "Order or Delivery Boy not found" });
    }

    order.assignedDeliveryBoy = deliveryBoy._id;
    order.status = "Out for delivery";
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("assignedDeliveryBoy", "name phone vehicleType");

    req.io.to("sellerRoom").emit("orderUpdated", populatedOrder);
    req.io.to(deliveryBoyId).emit("orderUpdated", populatedOrder);

    res.json(populatedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};
