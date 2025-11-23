import express from "express";
import {
  listServerNodePowers,
  getServerNodePower,
  createServerNodePower,
  updateServerNodePower,
  deleteServerNodePower,
} from "../controllers/serverNodePower.controller.js";
import { authenticate } from "../middlewares/auth.middlewares.js";

const router = express.Router();

router.get("/api/server-node-powers", authenticate, listServerNodePowers);
router.get("/api/server-node-powers/:id", authenticate, getServerNodePower);
router.post("/api/server-node-powers", authenticate, createServerNodePower);
router.put("/api/server-node-powers/:id", authenticate, updateServerNodePower);
router.delete("/api/server-node-powers/:id", authenticate, deleteServerNodePower);

export default router;
