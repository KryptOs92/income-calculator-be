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

router.use(authenticate);

router.get("/api/crypto-addresses", listCryptoAddresses);
router.get("/api/crypto-addresses/:id", getCryptoAddress);
router.post("/api/crypto-addresses", createCryptoAddress);
router.put("/api/crypto-addresses/:id", updateCryptoAddress);
router.delete("/api/crypto-addresses/:id", deleteCryptoAddress);

export default router;
