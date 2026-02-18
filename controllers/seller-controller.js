import Order from "../models/Order.js";


export const getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.seller._id; // from authSeller
    const orders = await Order.find({ seller: sellerId })  // filter by seller
      .populate("assignedDeliveryBoy", "name phone vehicleType")
      .populate("address", "city street state country phone")
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => ({
      _id: order._id,
      status: order.status,
      createdAt: order.createdAt,
      totalAmount: order.amount,
      assignedDeliveryBoy: order.assignedDeliveryBoy,
      orderDetails: {
        address: {
          city: order.address?.city,
          street: order.address?.street,
          state: order.address?.state,
          country: order.address?.country,
          phone: order.address?.phone,
        },
      },
    }));

    res.status(200).json({
      success: true,
      data: formattedOrders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch seller orders",
    });
  }
};
