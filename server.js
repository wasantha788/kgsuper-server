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

// Models & Routes (Keeping your imports as they were)
import Order from "./models/Order.js";
import DeliveryBoy from "./models/DeliveryBoy.js";
import OrderHistory from "./models/OrderHistory.js";
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

/* ---------------- FIX 1: ALLOWED ORIGINS ---------------- */
// You must include your Vercel URL here or it will block the "fetch"
const allowedOrigins = [
  "https://kgsuper-client-production.up.railway.app", // Railway client if you have one
                        
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

    /* 2️⃣ STRIPE WEBHOOK */
    app.post(
      "/stripe",
      express.raw({ type: "application/json" }),
      stripeWebhooks
    );

    /* 3️⃣ MIDDLEWARE FIX: Expanded CORS */
    app.use(express.json());
    app.use(cookieParser());
    app.use(cors({ 
      origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
          return callback(new Error('CORS policy violation'), false);
        }
        return callback(null, true);
      }, 
      credentials: true 
    }));

    /* 4️⃣ STATIC & ROUTES */
    app.use("/uploads", express.static("uploads"));
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

    /* 5️⃣ SOCKET.IO FIX: Added CORS to Socket */
    const io = new Server(server, {
      cors: { 
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
      },
    });

    // ... (Your Socket.io logic remains the same) ...
    io.on("connection", (socket) => {
        console.log("🔌 New connection:", socket.id);
        // ... (rest of your socket logic)
    });

    /* 6️⃣ START SERVER FIX: Added '0.0.0.0' */
    server.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${port}`);
    });

  } catch (error) {
    console.error("❌ Server failed:", error);
    process.exit(1);
  }
})();
