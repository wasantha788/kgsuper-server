import mongoose from "mongoose";

// Connect to MongoDB
const mongoURI = "mongodb://localhost:5173/greencart"; // change if needed

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// Define Order Schema (minimal for update)
const orderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model("Order", orderSchema, "orders"); // third param is collection name

async function addTrackingFields() {
  try {
    const orders = await Order.find({});
    console.log(`Found ${orders.length} orders.`);

    for (const order of orders) {
      let updated = false;

      // Add deliveryAgent if not exists
      if (!order.deliveryAgent) {
        order.deliveryAgent = {
          name: "",
          phone: "",
          agentId: null,
        };
        updated = true;
      }

      // Add location if not exists
      if (!order.location) {
        order.location = {
          lat: null,
          lng: null,
        };
        updated = true;
      }

      // Add handoverAt if not exists
      if (!order.handoverAt) {
        order.handoverAt = null;
        updated = true;
      }

      if (updated) {
        await order.save();
        console.log(`✅ Updated order ${order._id}`);
      }
    }

    console.log("🎉 All orders updated with tracking fields!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating orders:", err);
    process.exit(1);
  }
}

addTrackingFields();
