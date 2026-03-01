import express from "express";
import {
  register,
  login,
  logout,
  isAuth,
  updateProfile,
  deleteProfile,    // New controller
  updatePassword,   // New controller
} from "../controllers/userController.js";
import authUser from "../middlewares/authUser.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/is-auth", isAuth);

// Authenticated Routes
router.put("/update", authUser, updateProfile);
router.post("/update-password", authUser, updatePassword); // Matches your React frontend call
router.delete("/delete-profile", authUser, deleteProfile); // Matches your React frontend call

export default router;