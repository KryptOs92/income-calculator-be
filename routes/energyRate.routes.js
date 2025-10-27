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

router.use(authenticate);

router.get("/api/energy-rates", listEnergyRates);
router.get("/api/energy-rates/:id", getEnergyRate);
router.post("/api/energy-rates", createEnergyRate);
router.put("/api/energy-rates/:id", updateEnergyRate);
router.delete("/api/energy-rates/:id", deleteEnergyRate);

export default router;
