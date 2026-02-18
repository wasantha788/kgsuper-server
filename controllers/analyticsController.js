import Order from "../models/Order.js";
import DeliveryBoy from "../models/DeliveryBoy.js";


export const topDeliveryBoys = async (req, res) => {
  try {
    const riders = await DeliveryBoy.find()
      .select("name totalDelivered")
      .sort({ totalDelivered: -1 })
      .limit(5);

    res.status(200).json(riders);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch leaderboard",
    });
  }
};


export const getTopDeliveryBoys = async (req, res) => {
  try {
    const leaders = await Order.aggregate([
      { $match: { status: "Delivered", assignedDeliveryBoy: { $ne: null } } },
      { $group: { _id: "$assignedDeliveryBoy", totalDelivered: { $sum: 1 } } },
      { $sort: { totalDelivered: -1 } },
      { $limit: 10 }
    ]);

    const populatedLeaders = await DeliveryBoy.populate(leaders, { path: "_id", select: "name phone vehicleType" });

    const formattedLeaders = populatedLeaders.map(l => ({
      _id: l._id._id,
      name: l._id.name,
      phone: l._id.phone,
      vehicleType: l._id.vehicleType,
      totalDelivered: l.totalDelivered
    }));

    res.status(200).json(formattedLeaders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
};

export const getTopRiders = async (req, res) => {
  try {
    const topRiders = await Order.aggregate([
      { $match: { status: "Delivered" } }, // Only count delivered orders
      {
        $group: {
          _id: "$assignedDeliveryBoy",
          totalDelivered: { $sum: 1 }
        }
      },
      { $lookup: { // Join with the User/DeliveryBoy collection to get names
          from: "users", 
          localField: "_id",
          foreignField: "_id",
          as: "riderInfo"
      }},
      { $unwind: "$riderInfo" },
      { $project: {
          name: "$riderInfo.name",
          totalDelivered: 1
      }},
      { $sort: { totalDelivered: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json(topRiders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};