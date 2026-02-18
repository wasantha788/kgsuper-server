import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // Customer
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    // Order items
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true },
      },
    ],

    // Pricing
    amount: { type: Number, required: true },

    // Address
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "address",
      required: true,
    },

    // Status
    status: {
      type: String,
      enum: [
        "Order Placed",
        "Processing",
        "Packing",
        "Assigned",
        "Out for delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Order Placed",
    },
    
       // Payment OTP
    paymentOTP: { type: String },
    paymentOTPExpire: { type: Date },
    otpVerified: { type: Boolean, default: false },

    
    // Payment
    paymentType: { type: String, required: true },
    isPaid: { type: Boolean, default: false },

 

    // 🚴 Delivery assignment
    assignedDeliveryBoy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null,
    },

    // ⏱ Tracking
    deliveryAcceptedAt: { type: Date },
    deliveredAt: { type: Date },


    chatEnabled: { type: Boolean, default: false },
    locationEnabled: { type: Boolean, default: false },

    chatStatus: {
    type: String,
    enum: ["none", "requested", "accepted"],
    default: "none"
}


  },
  { timestamps: true },
);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;
