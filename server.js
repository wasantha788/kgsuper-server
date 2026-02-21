// server.js
import "dotenv/config"; // Automatically loads .env variables
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
import analyticsRoutes from "./routes/analyticsRoutes.js";

const app = express();
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  "https://kgsuper-client-production.up.railway.app",
  /\.railway\.app$/ // Any railway subdomain
];

const startServer = async () => {
  try {
    console.log("🚀 Starting server...");

    // 1️⃣ CONNECT TO DATABASE
    try {
      await connectDB();
      console.log("✅ Database connected");
    } catch (dbErr) {
      console.error("❌ Database connection failed:", dbErr);
      process.exit(1);
    }

    // 2️⃣ CONNECT TO CLOUDINARY
    try {
      await connectCloudinary();
      console.log("✅ Cloudinary connected");
    } catch (cloudErr) {
      console.error("❌ Cloudinary connection failed:", cloudErr);
      process.exit(1);
    }

    // 3️⃣ STRIPE WEBHOOK (BEFORE express.json)
    app.post("/stripe", express.raw({ type: "application/json" }), stripeWebhooks);

    // 4️⃣ MIDDLEWARE
    app.use(express.json());
    app.use(cookieParser());
    app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE"],
      })
    );

    // 5️⃣ STATIC FILES
    app.use("/uploads", express.static("uploads"));

    // 6️⃣ BASIC ROUTES
    app.get("/", (req, res) => res.status(200).send("API is Working ✅"));
    app.get("/health", (req, res) => res.status(200).send("OK")); // Railway health check

    // 7️⃣ API ROUTES
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

    // 8️⃣ SOCKET.IO
    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
      },
    });
    setIO(io);

    // 9️⃣ START SERVER
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // 1️⃣0️⃣ Graceful shutdown on SIGTERM (Railway signals)
    process.on("SIGTERM", () => {
      console.log("🔹 SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    });

    // 1️⃣1️⃣ Catch uncaught exceptions & unhandled rejections
    process.on("uncaughtException", (err) => {
      console.error("❌ Uncaught Exception:", err);
      process.exit(1);
    });

    process.on("unhandledRejection", (err) => {
      console.error("❌ Unhandled Rejection:", err);
      process.exit(1);
    });

  } catch (err) {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
  }
};

startServer();