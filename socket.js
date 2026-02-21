import Order from "./models/Order.js";
import DeliveryBoy from "./models/DeliveryBoy.js";
import OrderHistory from "./models/OrderHistory.js";

export let io;

// ---------------- SOCKET STATE ----------------
const deliveryBoys = new Map();      // deliveryBoyId → socketId
const activeConnections = new Map(); // roomId → Map(socketId → { name })
const userNames = new Map();         // socketId → userName

export const setIO = (serverIo) => {
  io = serverIo;

  io.on("connection", (socket) => {
    console.log("🔌💙💙 New connection:", socket.id);

    // ---------------- HEARTBEAT PING ----------------
    socket.conn.on("packet", (packet) => {
      if (packet.type === "ping") {
        socket.emit("pong");
      }
    });

    // ---------------- BASIC REGISTRATION ----------------
    socket.on("set_name", (name, callback) => {
      userNames.set(socket.id, name || "User");
      callback?.({ success: true });
    });

    socket.on("join_seller", () => {
      socket.join("sellerRoom");
    });

    // ---------------- DELIVERY AGENT REGISTRATION ----------------
    socket.on("registerDeliveryBoy", async (deliveryBoyId, callback) => {
      if (!deliveryBoyId) return callback?.({ success: false, message: "Missing deliveryBoyId" });

      socket.deliveryBoyId = deliveryBoyId;
      socket.join("deliveryRoom");
      socket.join(`delivery:${deliveryBoyId}`);
      deliveryBoys.set(deliveryBoyId, socket.id);

      try {
        const myOrders = await Order.find({ assignedDeliveryBoy: deliveryBoyId })
          .populate("items.product")
          .populate("address")
          .sort({ createdAt: -1 });

        socket.emit("myOrders", myOrders);
        callback?.({ success: true, orders: myOrders });
      } catch (err) {
        console.error("❌ Load orders error:", err);
        callback?.({ success: false, message: err.message });
      }
    });

    // ---------------- ORDER & CHAT ROOMS ----------------
    socket.on("join_order_room", (orderId, callback) => {
      if (!orderId) return callback?.({ success: false, message: "Missing orderId" });

      socket.join(orderId);

      if (!activeConnections.has(orderId)) activeConnections.set(orderId, new Map());
      activeConnections.get(orderId).set(socket.id, { name: userNames.get(socket.id) || "User" });

      console.log(`📡 ${socket.id} joined order room ${orderId}`);
      callback?.({ success: true });
    });

    // ---------------- LIVE LOCATION TRACKING ----------------
    socket.on("request_location", ({ room }) => {
      if (!room) return;
      socket.to(room).emit("request_location_ping", { requesterId: socket.id });
    });

    socket.on("share_location", ({ room, location }) => {
      if (!room || !location) return;
      socket.to(room).emit("receive_location", { location });
    });

    // ---------------- CHAT CONNECTIVITY ----------------
    socket.on("request_connection", async ({ room }) => {
      try {
        await Order.findByIdAndUpdate(room, { chatStatus: "requested" });
        socket.to(room).emit("request_connection", {
          senderId: socket.id,
          senderName: userNames.get(socket.id) || "Delivery Partner",
        });
      } catch (err) {
        console.error("❌ request_connection error:", err);
      }
    });

    socket.on("accept_connection", async ({ room, senderId }) => {
      try {
        await Order.findByIdAndUpdate(room, { chatStatus: "accepted" });
        socket.to(senderId).emit("accept_connection");
        socket.emit("accept_connection");
      } catch (err) {
        console.error("❌ accept_connection error:", err);
      }
    });

    socket.on("reject_connection", ({ senderId }) => {
      if (!senderId) return;
      socket.to(senderId).emit("reject_connection");
    });

    // ---------------- CHAT: SEND MESSAGE ----------------
    socket.on("send_message", ({ room, message, senderId, senderName, senderRole, timestamp }) => {
      if (!room || !message) return;
      const payload = {
        senderId: String(senderId),
        senderName,
        senderRole,
        message,
        timestamp: timestamp || new Date().toISOString(),
      };
      socket.to(room).emit("receive_message", payload);
    });

    // ---------------- ORDER FLOW LOGIC ----------------
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

        if (!order) return socket.emit("orderRejectedNotification", { message: "Order already taken!" });

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

          socket.emit("orderDelivered", order);
          io.to("sellerRoom").emit("orderDelivered", {
            orderId: order._id,
            deliveryBoy: {
              name: order.assignedDeliveryBoy.name,
              phone: order.assignedDeliveryBoy.phone,
              vehicle: order.assignedDeliveryBoy.vehicleType,
            },
          });

          io.emit("leaderboardUpdated");
        }
      } catch (err) {
        console.error("❌ update-order-status error:", err);
      }
    });

    // ---------------- DISCONNECT ----------------
    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);

      if (socket.deliveryBoyId) deliveryBoys.delete(socket.deliveryBoyId);
      userNames.delete(socket.id);

      activeConnections.forEach((map, room) => {
        map.delete(socket.id);
        if (map.size === 0) activeConnections.delete(room);
      });
    });
  });
};