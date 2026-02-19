import dotenv from "dotenv";
dotenv.config();

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
const port = process.env.PORT || 8080;
const server = http.createServer(app);

const allowedOrigins = ["https://kgsuper-client-production.up.railway.app"];


(async () => {
  try {
    // 1️⃣ CONNECT DATABASE FIRST
    await connectDB();
    await connectCloudinary();
    console.log("✅ Database & Cloudinary connected");

    // 2️⃣ STRIPE WEBHOOK (before express.json)
    app.post(
      "/stripe",
      express.raw({ type: "application/json" }),
      stripeWebhooks
    );

    // 3️⃣ MIDDLEWARE
    app.use(express.json());
    app.use(cookieParser());
    app.use(cors({ origin: allowedOrigins, credentials: true }));

    // 4️⃣ STATIC FILES
    app.use("/uploads", express.static("uploads"));

    // 5️⃣ ROUTES
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
   

    // 6️⃣ SOCKET.IO (AFTER DB)
    const io = new Server(server, {
      cors: { origin: allowedOrigins },
    });
    setIO(io);

    // 7️⃣ START SERVER LAST
    server.listen(port, () => {
      console.log(`🚀 Server + Socket.IO running on http://localhost:${port}`);
    });

  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
})();

