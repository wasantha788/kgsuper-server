import express from "express";
import { registerSellerRequest } from "../controllers/sellerRegisterController.js";
import { loginSellerRequest } from "../controllers/sellerLoginController.js";


const router = express.Router();

router.post("/sellerrequestusers", registerSellerRequest);
router.post("/sellerrequestlogin", loginSellerRequest);


export default router;
