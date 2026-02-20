import "dotenv/config";
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
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

const allowedOrigins = [
  "https://kgsuper-client-production.up.railway.app",
  /\.railway\.app$/
];

const startServer = async () => {
  try {
    await connectDB();
    await connectCloudinary();
    console.log("✅ Database & Cloudinary connected");

    // STRIPE WEBHOOK (before express.json())
    app.post("/api/webhook", express.raw({ type: "application/json" }), stripeWebhooks);

    // MIDDLEWARE
    app.use(express.json());
    app.use(cookieParser());
    app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE"],
      })
    );

    // STATIC FILES
    app.use("/uploads", express.static("uploads"));

    // ROUTES
    app.get("/", (req, res) => res.status(200).send("API is Working ✅"));
    app.get("/health", (req, res) => res.status(200).send("OK"));

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

    // SOCKET.IO
    const io = new Server(server, {
      cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
    });
    setIO(io);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
};

startServer();
