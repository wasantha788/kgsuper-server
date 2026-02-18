// models/DeliveryBoyOrder.js
import mongoose from "mongoose";

const deliveryBoyOrderSchema = new mongoose.Schema({
  deliveryBoy: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  orderDetails: { type: Object}, // store full order details
  status: {
      type: String,
      enum: ["Order Placed", "Processing", "Packing", "Out for delivery", "Delivered", "Cancelled"],
      default: "Order Placed",
    },
  acceptedAt: { type: Date, default: Date.now },

   },
  { timestamps: true } 
)
export default mongoose.model("DeliveryBoyOrder", deliveryBoyOrderSchema, "deliveryboyorders");
