import express from 'express';
import { isSellerAuth, sellerLogin, sellerRegister, sellerLogout } from '../controllers/sellerController.js';
import authSeller from '../middlewares/authSeller.js';
import { getSellerOrders } from "../controllers/seller-controller.js";
import { topDeliveryBoys } from "../controllers/analyticsController.js";

const sellerRouter = express.Router();

// 🔓 Public Routes (Token එකක් අවශ්‍ය නැත)
sellerRouter.post('/login', sellerLogin);
sellerRouter.post('/register', sellerRegister);
sellerRouter.get('/logout', sellerLogout);

// 🔒 Protected Routes (අනිවාර්යයෙන්ම authSeller middleware එක හරහා යා යුතුය)
sellerRouter.get('/is-auth', authSeller, isSellerAuth);
sellerRouter.get("/orders", authSeller, getSellerOrders);
sellerRouter.get('/top-delivery-boys', authSeller, topDeliveryBoys);

export default sellerRouter;