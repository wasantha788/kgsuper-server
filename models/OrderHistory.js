import mongoose from "mongoose";

const orderHistorySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    deliveryBoy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
    },

    action: {
      type: String,
      enum: ["accepted", "rejected", "delivered", "cancelled"],
      required: true,
    },

    status: {
      type: String, // snapshot of order status at this action
      required: true,
    },

    note: {
      type: String, // optional notes
      default: "",
    },

    totalAmount: {
      type: Number, // total order price (for delivered)
      default: 0,
    },

    deliveredAt: {
      type: Date, // exact delivery timestamp
    },

    // New field: store just the day (midnight) for easier daily aggregation
    deliveredDay: {
      type: Date,
      default: null,
      index: true, // indexed for faster chart queries
    },
  },
  { timestamps: true } // createdAt and updatedAt
);

// Index for faster reporting
orderHistorySchema.index({ deliveryBoy: 1, action: 1, deliveredDay: -1 });

export default mongoose.model("OrderHistory", orderHistorySchema);
