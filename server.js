import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./configs/db.js";
import connectCloudinary from "./configs/cloudinary.js";
import { stripeWebhooks } from "./controllers/orderControler.js";

// Models
import Order from "./models/Order.js";
import DeliveryBoy from "./models/DeliveryBoy.js";
import OrderHistory from "./models/OrderHistory.js";

// Routes
import userRouter from "./routes/userRoute.js";
import sellerRouter from "./routes/sellerRoute.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import addressRouter from "./routes/addressRoute.js";
import orderRouter from "./routes/orderRoute.js";
import sellerRequestRoute from "./routes/sellerRequestRoute.js";
import sellerRegisterRoutes from "./routes/sellerRegisterRoutes.js";
import deliveryRoutes from "./routes/deliveryRoute.js";
import analyticsRoutes from "./routes/analyticsRoute.js";

const app = express();
const port = process.env.PORT || 8080;
const server = http.createServer(app);

const allowedOrigins = [

  "https://kgsuper-client-hi81wj2wo-wasanthas-projects.vercel.app",
];

/* ---------------- SOCKET STATE ---------------- */
const deliveryBoys = new Map();
const activeConnections = new Map();
const userNames = new Map();

(async () => {
  try {
    /* 1️⃣ CONNECT DATABASE */
    await connectDB();
    await connectCloudinary();
    console.log("✅ Database & Cloudinary connected");

    /* 2️⃣ STRIPE WEBHOOK (before express.json) */
    app.post(
      "/stripe",
      express.raw({ type: "application/json" }),
      stripeWebhooks
    );

    /* 3️⃣ MIDDLEWARE */
    app.use(express.json());
    app.use(cookieParser());
    app.use(cors({ origin: allowedOrigins, credentials: true }));

    /* 4️⃣ STATIC */
    app.use("/uploads", express.static("uploads"));

    /* 5️⃣ ROUTES */
    app.get("/", (req, res) => res.send("API is Working ✅"));
    app.use("/api/user", userRouter);
    app.use("/api/seller", sellerRouter);
    app.use("/api", sellerRegisterRoutes);
    app.use("/api/sellerRequest", sellerRequestRoute);
    app.use("/api/product", productRouter);
    app.use("/api/cart", cartRouter);
    app.use("/api/address", addressRouter);
    app.use("/api/order", orderRouter);
    app.use("/api/delivery", deliveryRoutes);
    app.use("/api/analytics", analyticsRoutes);

    /* 6️⃣ SOCKET.IO */
    const io = new Server(server, {
      cors: { origin: allowedOrigins },
    });

    io.on("connection", (socket) => {
      console.log("🔌 New connection:", socket.id);

      /* ---------- BASIC ---------- */
      socket.on("set_name", (name) => {
        userNames.set(socket.id, name);
      });

      socket.on("join_seller", () => {
        socket.join("sellerRoom");
      });

      /* ---------- DELIVERY REGISTER ---------- */
      socket.on("registerDeliveryBoy", async (deliveryBoyId) => {
        if (!deliveryBoyId) return;

        socket.deliveryBoyId = deliveryBoyId;
        socket.join("deliveryRoom");
        socket.join(`delivery:${deliveryBoyId}`);
        deliveryBoys.set(deliveryBoyId, socket.id);

        try {
          const myOrders = await Order.find({
            assignedDeliveryBoy: deliveryBoyId,
          })
            .populate("items.product")
            .populate("address")
            .sort({ createdAt: -1 });

          socket.emit("myOrders", myOrders);
        } catch (err) {
          console.error("❌ Load orders error:", err);
        }
      });

      /* ---------- ORDER ROOM ---------- */
      socket.on("join_order_room", (orderId) => {
        if (!orderId) return;

        socket.join(orderId);

        if (!activeConnections.has(orderId)) {
          activeConnections.set(orderId, new Map());
        }

        activeConnections.get(orderId).set(socket.id, {
          name: userNames.get(socket.id) || "User",
        });
      });

      /* ---------- LOCATION ---------- */
      socket.on("request_location", ({ room }) => {
        socket.to(room).emit("request_location_ping", {
          requesterId: socket.id,
        });
      });

      socket.on("share_location", ({ room, location }) => {
        socket.to(room).emit("receive_location", { location });
      });

      /* ---------- CHAT ---------- */
      socket.on("send_message", ({ room, message, senderId, senderName, senderRole, timestamp }) => {
        const payload = {
          senderId: String(senderId),
          senderName,
          senderRole,
          message,
          timestamp: timestamp || new Date().toISOString(),
        };

        socket.to(room).emit("receive_message", payload);
      });

      /* ---------- SEND TO DELIVERY ---------- */
      socket.on("send-to-delivery", async ({ order }) => {
        if (!order?._id) return;

        try {
          const freshOrder = await Order.findById(order._id)
            .populate("items.product")
            .populate("address")
            .populate("assignedDeliveryBoy", "name phone vehicleType");

          io.to("deliveryRoom").emit("newDeliveryOrder", freshOrder);
        } catch (err) {
          console.error("❌ send-to-delivery error:", err);
        }
      });

      /* ---------- ACCEPT ORDER ---------- */
      socket.on("accept-order", async ({ orderId }) => {
        try {
          const deliveryBoyId = socket.deliveryBoyId;
          if (!deliveryBoyId) return;

          const order = await Order.findOneAndUpdate(
            { _id: orderId, assignedDeliveryBoy: null },
            { assignedDeliveryBoy: deliveryBoyId, status: "Out for delivery" },
            { new: true }
          )
            .populate("items.product")
            .populate("address")
            .populate("assignedDeliveryBoy", "name phone vehicleType");

          if (!order) {
            return socket.emit("orderRejectedNotification", {
              message: "Order already taken!",
            });
          }

          socket.emit("orderUpdated", order);
          socket.to("deliveryRoom").emit("orderRemoved", { orderId });

          io.to("sellerRoom").emit("orderAcceptedByDelivery", {
            orderId: order._id,
            status: order.status,
            deliveryBoy: {
              name: order.assignedDeliveryBoy.name,
              phone: order.assignedDeliveryBoy.phone,
              vehicle: order.assignedDeliveryBoy.vehicleType,
            },
          });
        } catch (err) {
          console.error("❌ accept-order error:", err);
        }
      });

      /* ---------- UPDATE STATUS ---------- */
      socket.on("update-order-status", async ({ orderId, status }) => {
        try {
          const deliveryBoyId = socket.deliveryBoyId;
          if (!deliveryBoyId) return;

          const order = await Order.findOneAndUpdate(
            { _id: orderId, assignedDeliveryBoy: deliveryBoyId },
            { status },
            { new: true }
          )
            .populate("items.product")
            .populate("address")
            .populate("assignedDeliveryBoy", "name phone vehicleType");

          if (!order) return;

          socket.emit("orderUpdated", order);
          io.to("sellerRoom").emit("orderUpdated", order);

          if (status === "Delivered") {
            const now = new Date();
            const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            await OrderHistory.create({
              orderId: order._id,
              deliveryBoy: deliveryBoyId,
              action: "delivered",
              status: "Delivered",
              totalAmount: order.amount,
              deliveredAt: now,
              deliveredDay: day,
            });

            await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
              $inc: { totalDelivered: 1 },
              activeOrder: null,
              isAvailable: true,
            });

            io.emit("leaderboardUpdated");
          }
        } catch (err) {
          console.error("❌ update-order-status error:", err);
        }
      });

      /* ---------- DISCONNECT ---------- */
      socket.on("disconnect", () => {
        console.log("❌ Disconnected:", socket.id);

        if (socket.deliveryBoyId) {
          deliveryBoys.delete(socket.deliveryBoyId);
        }

        userNames.delete(socket.id);

        activeConnections.forEach((map, room) => {
          map.delete(socket.id);
          if (map.size === 0) activeConnections.delete(room);
        });
      });
    });

    /* 7️⃣ START SERVER */
    server.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
    });

  } catch (error) {
    console.error("❌ Server failed:", error);
    process.exit(1);
  }
})();

