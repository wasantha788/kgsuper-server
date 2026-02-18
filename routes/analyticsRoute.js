import express from "express";
import Order from "../models/Order.js";
import DeliveryBoy from "../models/DeliveryBoy.js"; // import model to populate
const router = express.Router();

router.get("/top-delivery-boys", async (req, res) => {
  try {
    // Aggregate only delivered orders
    const leaders = await Order.aggregate([
      { $match: { status: "Delivered", deliveryBoy: { $ne: null } } },
      {
        $group: {
          _id: "$deliveryBoy",
          totalDelivered: { $sum: 1 },
        },
      },
      { $sort: { totalDelivered: -1 } },
      { $limit: 10 },
    ]);

    // Populate delivery boy info
    const populatedLeaders = await DeliveryBoy.populate(leaders, { path: "_id", select: "name phone vehicleType" });

    const formattedLeaders = populatedLeaders.map(l => ({
      _id: l._id._id, // delivery boy ObjectId
      name: l._id.name,
      phone: l._id.phone,
      vehicleType: l._id.vehicleType,
      totalDelivered: l.totalDelivered,
    }));

    res.json(formattedLeaders);
  } catch (err) {
    console.error("Leaderboard fetch error:", err);
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
});

export default router;
