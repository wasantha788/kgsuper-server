import mongoose from "mongoose";

const deliveryAgentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // changed "Id" to "id" and added unique
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  ordersCompleted: { type: Number, default: 0 },
  isAvailable: { type: Boolean, default: true }, // useful for assigning orders
  lastLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  lastLocationUpdated: { type: Date },
}, { timestamps: true });

export default mongoose.model("DeliveryAgent", deliveryAgentSchema);
