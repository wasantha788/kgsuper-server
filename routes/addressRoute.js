import express from "express";
import authUser from "../middlewares/authUser.js";
import {
  addAddress,
  getAddress,
  deleteAddress,
} from "../controllers/addressController.js";

const router = express.Router();

router.post("/add", authUser, addAddress);
router.get("/get", authUser, getAddress);
router.delete("/:id", authUser, deleteAddress);

export default router;
