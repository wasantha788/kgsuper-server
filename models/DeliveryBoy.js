import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const deliveryBoySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true },
    password: { type: String, required: true },

    role: { type: String, default: "delivery" },

    phone: { type: String }, 
    vehicleType: { type: String }, 


    totalDelivered: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },

    activeOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
  },
  { timestamps: true }
);

deliveryBoySchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model("DeliveryBoy", deliveryBoySchema,"deliveryboys");
