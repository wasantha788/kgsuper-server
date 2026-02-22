import "dotenv/config"; 
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./configs/db.js";
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

// CORS Configuration
const allowedOrigins = [
  "https://kgsuper-client-production.up.railway.app",
  /\.railway\.app$/ 
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); 
    const allowed = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    callback(null, allowed);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
};

// Start Server Function
const startServer = async () => {
  try {
    // 1️⃣ Connect to MongoDB
    await connectDB();
    
    // Cloudinary is already connected because it was imported as a 
    // configured object at the top of the file. 
    console.log("✅ Database & Cloudinary connected");

    // 2️⃣ Stripe Webhook (must be before JSON parser)
    app.post("/stripe", express.raw({ type: "application/json" }), stripeWebhooks);

    // 3️⃣ Middleware
    app.use(express.json());
    app.use(cookieParser());
    app.use(cors(corsOptions));

   

    // 4️⃣ Basic routes
    app.get("/", (req, res) => res.status(200).send("API is Working ✅"));
    app.get("/health", (req, res) => res.status(200).send("OK")); 

    // 5️⃣ API Routes
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

    // 6️⃣ Socket.IO
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

    // 7️⃣ Start Server
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Graceful Shutdown
    process.on("SIGTERM", () => {
      server.close(() => {
        process.exit(0);
      });
    });

  } catch (err) {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
  }
};

startServer();