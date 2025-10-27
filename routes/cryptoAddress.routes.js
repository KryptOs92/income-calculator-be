import express from "express";
import {
  listCryptoAddresses,
  getCryptoAddress,
  createCryptoAddress,
  updateCryptoAddress,
  deleteCryptoAddress,
} from "../controllers/cryptoAddress.controller.js";
import { authenticate } from "../middlewares/auth.middlewares.js";

const router = express.Router();

router.get("/api/crypto-addresses", authenticate, listCryptoAddresses);
router.get("/api/crypto-addresses/:id", authenticate, getCryptoAddress);
router.post("/api/crypto-addresses", authenticate, createCryptoAddress);
router.put("/api/crypto-addresses/:id", authenticate, updateCryptoAddress);
router.delete("/api/crypto-addresses/:id", authenticate, deleteCryptoAddress);

export default router;
