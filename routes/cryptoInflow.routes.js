import express from "express";
import {
  listCryptoInflows,
  getCryptoInflow,
  createCryptoInflow,
  updateCryptoInflow,
  deleteCryptoInflow,
} from "../controllers/cryptoInflow.controller.js";
import { authenticate } from "../middlewares/auth.middlewares.js";

const router = express.Router();

router.get("/api/crypto-inflows", authenticate, listCryptoInflows);
router.get("/api/crypto-inflows/:id", authenticate, getCryptoInflow);
router.post("/api/crypto-inflows", authenticate, createCryptoInflow);
router.put("/api/crypto-inflows/:id", authenticate, updateCryptoInflow);
router.delete("/api/crypto-inflows/:id", authenticate, deleteCryptoInflow);

export default router;
