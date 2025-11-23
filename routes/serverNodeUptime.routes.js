import express from "express";
import {
  listServerNodeUptimes,
  getServerNodeUptime,
  createServerNodeUptime,
  updateServerNodeUptime,
  deleteServerNodeUptime,
} from "../controllers/serverNodeUptime.controller.js";
import { authenticate } from "../middlewares/auth.middlewares.js";

const router = express.Router();

router.get("/api/server-node-uptimes", authenticate, listServerNodeUptimes);
router.get("/api/server-node-uptimes/:id", authenticate, getServerNodeUptime);
router.post("/api/server-node-uptimes", authenticate, createServerNodeUptime);
router.put("/api/server-node-uptimes/:id", authenticate, updateServerNodeUptime);
router.delete("/api/server-node-uptimes/:id", authenticate, deleteServerNodeUptime);

export default router;
