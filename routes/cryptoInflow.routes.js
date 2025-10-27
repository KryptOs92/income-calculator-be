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

router.use(authenticate);

router.get("/api/crypto-inflows", listCryptoInflows);
router.get("/api/crypto-inflows/:id", getCryptoInflow);
router.post("/api/crypto-inflows", createCryptoInflow);
router.put("/api/crypto-inflows/:id", updateCryptoInflow);
router.delete("/api/crypto-inflows/:id", deleteCryptoInflow);

export default router;
