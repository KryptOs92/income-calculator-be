import express from "express";
import {
  register,
  login,
  refreshSession,
  logout,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/api/auth/register", register);
router.post("/api/auth/login", login);
router.post("/api/auth/refresh", refreshSession);
router.post("/api/auth/logout", logout);
router.get("/api/auth/verify-email", verifyEmail);
router.post("/api/auth/request-password-reset", requestPasswordReset);
router.post("/api/auth/reset-password", resetPassword);

export default router;
