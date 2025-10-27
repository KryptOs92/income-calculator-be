import express from "express";
import {
  listEnergyRates,
  getEnergyRate,
  createEnergyRate,
  updateEnergyRate,
  deleteEnergyRate,
} from "../controllers/energyRate.controller.js";
import { authenticate } from "../middlewares/auth.middlewares.js";

const router = express.Router();

router.get("/api/energy-rates", authenticate, listEnergyRates);
router.get("/api/energy-rates/:id", authenticate, getEnergyRate);
router.post("/api/energy-rates", authenticate, createEnergyRate);
router.put("/api/energy-rates/:id", authenticate, updateEnergyRate);
router.delete("/api/energy-rates/:id", authenticate, deleteEnergyRate);

export default router;
