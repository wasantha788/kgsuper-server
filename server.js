import "dotenv/config"; // Shorthand for import + config
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
// Railway automatically injects the PORT variable. 
// Use 0.0.0.0 to ensure it's accessible externally.
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// Update allowedOrigins to include your production frontend URL
const allowedOrigins = [

  "https://kgsuper-client-production.up.railway.app",
  /\.railway\.app$/ // Allows any railway subdomains if needed
];

const startServer = async () => {
  try {
    // 1️⃣ CONNECT SERVICES
    await connectDB();
    await connectCloudinary();
    console.log("✅ Database & Cloudinary connected");

    // 2️⃣ STRIPE WEBHOOK (Must be before express.json)
    app.post(
      "/stripe",
      express.raw({ type: "application/json" }),
      stripeWebhooks
    );

    // 3️⃣ MIDDLEWARE
    app.use(express.json());
    app.use(cookieParser());
    app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE"],
      })
    );

    // 4️⃣ STATIC FILES
    app.use("/uploads", express.static("uploads"));

    // 5️⃣ ROUTES
    app.get("/", (req, res) => res.status(200).send("API is Working ✅"));
    app.get("/health", (req, res) => res.status(200).send("OK")); // Health check for Railway

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

    // 6️⃣ SOCKET.IO
    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
      },
    });
    setIO(io);

    // 7️⃣ START SERVER
    // Explicitly binding to 0.0.0.0 is best practice for cloud deployments
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
};

startServer();
