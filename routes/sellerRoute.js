import express from 'express';
import { isSellerAuth,sellerLogin, sellerLogout } from '../controllers/sellerController.js';
import authSeller from '../middlewares/authSeller.js';
import { getSellerOrders } from "../controllers/seller-controller.js";
import {topDeliveryBoys} from "../controllers/analyticsController.js";

const sellerRouter = express.Router();


sellerRouter.post('/login', sellerLogin);
sellerRouter.get('/is-auth',authSeller, isSellerAuth);
sellerRouter.get('/logout', sellerLogout);

sellerRouter.get("/orders",authSeller, getSellerOrders);
sellerRouter.get('/top-delivery-boys', authSeller,topDeliveryBoys);



export default sellerRouter;