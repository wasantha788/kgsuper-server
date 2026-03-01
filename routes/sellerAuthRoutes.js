import express from "express";
import {
  registerSellerRequest,
  loginSellerRequest,
  verifySellerEmail,
} from "../controllers/sellerAuthController.js";

const router = express.Router();

router.post("/register", registerSellerRequest);
router.post("/login", loginSellerRequest);
router.get("/verify-email", verifySellerEmail);

export default router;