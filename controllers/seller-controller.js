import mongoose from "mongoose"; // 👈 ඉහළින්ම මේක import කරගන්න
import Order from "../models/Order.js";
import Product from "../models/product.js";


export const getSellerOrders = async (req, res) => {
  try {
    // 1️⃣ ලොග් වෙලා ඉන්න කෙනා Seller කෙනෙක්ද කියා තහවුරු කරගන්නවා
    const sellerId = req.seller?._id; 
    if (!sellerId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Missing Seller Identity" });
    }
    
    // 2️⃣ Database එකේ තියෙන සියලුම පාරිභෝගිකයන්ගේ Orders (All Orders) එක පාර fetch කරලා ගන්නවා
    const allOrders = await Order.find({})
      .populate("assignedDeliveryBoy", "name phone vehicleType")
      .populate("items.product", "name price offerPrice image") // Product විස්තර විතරක් ගන්නවා
      .populate("address") 
       .sort({ createdAt: -1 }); // අලුත්ම ඒවා ඉහළට එන ලෙස සකසයි
    // 3️⃣ Frontend එක බලාපොරොත්තු වන විදිහට Format කරගන්නවා
    const formattedOrders = allOrders.map(order => ({
      _id: order._id,
      status: order.status,
      createdAt: order.createdAt,
      amount: order.amount || 0, 
      paymentType: order.paymentType || "cod", 
      isPaid: order.isPaid || false, 
      assignedDeliveryBoy: order.assignedDeliveryBoy || null,
      items: order.items || [], 
      address: {
        firstName: order.address?.firstName || "",
        lastName: order.address?.lastName || "",
        city: order.address?.city || "",
        street: order.address?.street || "",
        state: order.address?.state || "",
        country: order.address?.country || "",
        phone: order.address?.phone || "",
        email: order.address?.email || "", 
      },
    }));

    // 4️⃣ සියලුම Orders ලැයිස්තුව response එක ලෙස යවනවා
    return res.status(200).json({
      success: true,
      orders: formattedOrders, 
    });
  } catch (error) {
    console.error("Fetch All Orders for Seller Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message 
    });
  }
};