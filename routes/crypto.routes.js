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

router.use(authenticate);

router.get("/api/cryptos", listCryptos);
router.get("/api/cryptos/:id", getCrypto);
router.post("/api/cryptos", createCrypto);
router.put("/api/cryptos/:id", updateCrypto);
router.delete("/api/cryptos/:id", deleteCrypto);

export default router;
