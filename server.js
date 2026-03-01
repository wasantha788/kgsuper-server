import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import path from "path";

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
import sellerAuthRoutes from "./routes/sellerAuthRoutes.js";
import deliveryRoutes from "./routes/deliveryRoute.js";
import analyticsRoutes from "./routes/analyticsRoute.js";
import chat from "./routes/aiRoute.js";
import sellerAuthRoutes from "./routes/sellerAuthRoutes.js";

const app = express();
const port = process.env.PORT || 4000;

// IMPORTANT: create HTTP server first
const server = http.createServer(app);

// Allowed frontend URLs
const allowedOrigins = [
  "https://kgsuper-client-production.up.railway.app",
];

(async () => {
  try {
    // 1️⃣ CONNECT DATABASES FIRST
    await connectDB();
    console.log("✅ Database connected");
    await connectCloudinary();
    console.log("✅ Database & Cloudinary connected");

    // 2️⃣ STRIPE WEBHOOK (before express.json)
    app.post(
      "/stripe",
      express.raw({ type: "application/json" }),
      stripeWebhooks
    );

    // 3️⃣ GLOBAL MIDDLEWARE
    app.use(express.json());
    app.use(cookieParser());
    app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
      })
    );

    // 4️⃣ STATIC FILES
    app.use(
      "/uploads",
      express.static(path.join(process.cwd(), "uploads"))
    );

    // 5️⃣ ROUTES
    app.get("/", (req, res) => res.send("API is Working ✅"));
    app.use("/api/user", userRouter);
    app.use("/api/seller", sellerRouter);
    app.use("/api/auth", sellerAuthRoutes);
    app.use("/api/sellerRequest", sellerRequestRoute);
    app.use("/api/product", productRouter);
    app.use("/api/cart", cartRouter);
    app.use("/api/address", addressRouter);
    app.use("/api/order", orderRouter);
    app.use("/api/delivery", deliveryRoutes);
    app.use("/api/analytics", analyticsRoutes);
    app.use("/api/ai", chat);
    app.use("/api/verify", sellerAuthRoutes);

    // 6️⃣ SOCKET.IO SETUP
    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    setIO(io);

    // 7️⃣ START SERVER (Railway requires 0.0.0.0)
    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server + Socket.IO running on port ${port}`);
    });

  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
})();