// server.js
import "dotenv/config"; // Load .env variables
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./configs/db.js";
import connectCloudinary from "./configs/cloudinary.js";
import { setIO } from "./socket.js";
import { stripeWebhooks } from "./controllers/orderControler.js";

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
const PORT = process.env.PORT || 8080;
const server = http.createServer(app);

// =======================
// CORS Configuration
// =======================
const allowedOrigins = [
  "https://kgsuper-client-production.up.railway.app",
  /\.railway\.app$/ // regex to allow any Railway subdomain
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow Postman / mobile apps
    const allowed = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    callback(null, allowed);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
};

// =======================
// Start Server Function
// =======================
const startServer = async () => {
  try {
    // 1️⃣ Connect to MongoDB & Cloudinary
    await connectDB();
    await connectCloudinary();
    console.log("✅ Database & Cloudinary connected");

    // 2️⃣ Stripe Webhook (must be before JSON parser)
    app.post("/stripe", express.raw({ type: "application/json" }), stripeWebhooks);

    // 3️⃣ Middleware
    app.use(express.json());
    app.use(cookieParser());
    app.use(cors(corsOptions));

    // 4️⃣ Static files
    app.use("/uploads", express.static("uploads"));

    // 5️⃣ Basic routes
    app.get("/", (req, res) => res.status(200).send("API is Working ✅"));
    app.get("/health", (req, res) => res.status(200).send("OK")); // Railway health check

    // 6️⃣ API Routes
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

    // 7️⃣ Socket.IO
    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          const allowed = allowedOrigins.some(o =>
            o instanceof RegExp ? o.test(origin) : o === origin
          );
          callback(null, allowed);
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
    });
    setIO(io);

    // 8️⃣ Start Server
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // 9️⃣ Graceful Shutdown (Railway sends SIGTERM)
    process.on("SIGTERM", () => {
      console.log("🔹 SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    });

    // 10️⃣ Handle uncaught exceptions and unhandled rejections
    process.on("uncaughtException", err => {
      console.error("❌ Uncaught Exception:", err);
      process.exit(1);
    });

    process.on("unhandledRejection", err => {
      console.error("❌ Unhandled Rejection:", err);
      process.exit(1);
    });

  } catch (err) {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
  }
};

// Start the server
startServer();