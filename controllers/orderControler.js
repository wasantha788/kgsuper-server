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
    const userId = req.user.id; // Using auth middleware ID for security

    if (!userId || !address || !items || items.length === 0) {
      return res.json({ success: false, message: "Invalid order data" });
    }

    let subtotal = 0;

    // 1. Calculate subtotal from Database
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.json({ success: false, message: "Product not found" });
      
      const price = product.offerPrice ?? product.price;
      subtotal += price * item.quantity;
    }

    // 2. APPLY DELIVERY LOGIC (Tax Removed)
    // Free if 5000 or above, otherwise 300 LKR
    const deliveryFee = subtotal >= 5000 ? 0 : 300;
    
    // Final Amount = Subtotal + Delivery Fee
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

    // 1. Calculate the subtotal from the database (prevents price tampering)
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      const price = product.offerPrice ?? product.price;
      subtotal += price * item.quantity;

      productData.push({
        name: product.name,
        price,
        quantity: item.quantity,
      });
    }

    // 2. APPLY FRONTEND DELIVERY LOGIC (Tax Removed)
    // Free if 5000 or above, otherwise 300 LKR
    const deliveryFee = subtotal >= 5000 ? 0 : 300;

    // 3. Final calculation for DB (Subtotal + Delivery Fee)
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

    // 4. Create Stripe Line Items (Clean Price, No Tax)
    const line_items = productData.map((item) => ({
      price_data: {
        currency: "lkr",
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100), // Pure product price
      },
      quantity: item.quantity,
    }));

    // 5. Add Delivery Fee to Stripe Checkout if it applies
    if (deliveryFee > 0) {
      line_items.push({
        price_data: {
          currency: "lkr",
          product_data: { name: "Delivery Fee" },
          unit_amount: deliveryFee * 100, // 300 LKR to Stripe units
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

    // ✅ CORRECTED WEBHOOK BLOCK
if (sessions.data.length > 0) {
  const { orderId, userId } = sessions.data[0].metadata;

  // Chain the populates together without a semicolon in between
  const order = await Order.findByIdAndUpdate(
    orderId,
    { isPaid: true, status: "Order Placed" },
    { new: true }
  )
    .populate("items.product")
    .populate("address"); // Now address details will be available for generateInvoice

  // Clear user cart
  const user = await User.findByIdAndUpdate(
    userId,
    { cartItems: {} },
    { new: true }
  );

  if (order && user) {
    // Both order.address and order.items[i].product are now fully populated objects
    const invoicePath = await generateInvoice(order, user);
    
    // Send email and then delete the temp file
    await sendReceiptEmail(user.email, invoicePath);
    
    // Optional: Clean up the file after sending if you aren't doing it inside sendReceiptEmail
    // if (fs.existsSync(invoicePath)) fs.unlinkSync(invoicePath);
      }
    }
  }
}
// ------------------------
// GET SINGLE ORDER BY ID
// ------------------------
export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("items.product")
      .populate("assignedDeliveryBoy", "name phone vehicleType");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ------------------------
// GET USER ORDERS
// ------------------------
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.find({ user: userId })  // ✅ FIXED
      .populate("items.product")
      .populate("address")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    res.json({ success: false, message: error.message });
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
// UPDATE ORDER STATUS (ADMIN)
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
    const orders = await Order.find()
      .populate("user", "name email")
      .populate("assignedDeliveryBoy", "name phone")
      .populate("address")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: orders });
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
