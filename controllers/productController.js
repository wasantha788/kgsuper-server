import { v2 as cloudinary } from "cloudinary";
import Product from "../models/product.js";

// -------------------- ADD PRODUCT --------------------
export const addProduct = async (req, res) => {
  try {
    const productData = JSON.parse(req.body.productData);
    const images = req.files || [];

    // Upload multiple images to Cloudinary
    const imagesUrl = await Promise.all(
      images.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          resource_type: "image",
        });
        return result.secure_url;
      })
    );

    const product = await Product.create({
      ...productData,
      image: imagesUrl,
      inStock: productData.inStock ?? true, // default true
    });

    res.json({ success: true, product, message: "Product Added Successfully" });
  } catch (error) {
    console.error("Add Product Error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// -------------------- LIST ALL PRODUCTS --------------------
export const productList = async (req, res) => {
  try {
    const products = await Product.find({});
    res.json({ success: true, products });
  } catch (error) {
    console.error("Product List Error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// -------------------- GET PRODUCT BY ID --------------------
export const productById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product)
      return res.json({ success: false, message: "Product not found." });

    res.json({ success: true, product });
  } catch (error) {
    console.error("Product By ID Error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// -------------------- CHANGE PRODUCT STOCK --------------------
export const changeStock = async (req, res) => {
  try {
    const { id, inStock } = req.body;

    await Product.findByIdAndUpdate(id, { inStock });

    res.json({ success: true, message: "Stock Updated Successfully" });
  } catch (error) {
    console.error("Change Stock Error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// -------------------- PRODUCTS BY CATEGORY --------------------
export const productsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!category)
      return res.json({ success: false, message: "Category required." });

    const products = await Product.find({
      category: { $regex: new RegExp(`^${category}$`, "i") },
    });

    res.json({ success: true, products });
  } catch (error) {
    console.error("Products By Category Error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// -------------------- DELETE PRODUCT (MISSING) --------------------
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.body;

    const product = await Product.findByIdAndDelete(id);
    if (!product)
      return res.json({ success: false, message: "Product not found." });

    res.json({ success: true, message: "Product Deleted Successfully" });
  } catch (error) {
    console.error("Delete Product Error:", error.message);
    res.json({ success: false, message: error.message });
  }
};
