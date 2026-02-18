import express from "express";
import {
  register,
  login,
  logout,
  isAuth,
  updateProfile,
} from "../controllers/userController.js";
import authUser from "../middlewares/authUser.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/is-auth", isAuth);
router.put("/update", authUser, updateProfile);



export default router;
