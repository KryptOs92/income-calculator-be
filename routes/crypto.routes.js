import express from "express";
import {
  listCryptos,
  getCrypto,
  createCrypto,
  updateCrypto,
  deleteCrypto,
} from "../controllers/crypto.controller.js";
import { authenticate } from "../middlewares/auth.middlewares.js";

const router = express.Router();

router.get("/api/cryptos", authenticate, listCryptos);
router.get("/api/cryptos/:id", authenticate, getCrypto);
router.post("/api/cryptos", authenticate, createCrypto);
router.put("/api/cryptos/:id", authenticate, updateCrypto);
router.delete("/api/cryptos/:id", authenticate, deleteCrypto);

export default router;
