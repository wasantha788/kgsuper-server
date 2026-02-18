import express from "express";
import {
  addProduct,
  productList,
  productById,
  changeStock,
  productsByCategory,
  deleteProduct,
} from "../controllers/productController.js";
import authSeller from "../middlewares/authSeller.js";
import multer from "multer";

const router = express.Router();

// ✅ Multer setup for image uploads
const storage = multer.diskStorage({});
const upload = multer({ storage });

// ------------------------- ROUTES -------------------------

// Add product (only seller)
router.post("/add", authSeller, upload.array("images", 5), addProduct);

// List all products
router.get("/list", productList);

// Get single product by ID
router.get("/:id", productById);

// Change stock (toggle inStock) - only seller
router.post("/stock", authSeller, changeStock);

// Get products by category
router.get("/category/:category", productsByCategory);

router.post("/delete", deleteProduct);


export default router;
