import express from "express";
import {
  listServerNodes,
  getServerNode,
  createServerNode,
  updateServerNode,
  deleteServerNode,
} from "../controllers/serverNode.controller.js";
import { authenticate } from "../middlewares/auth.middlewares.js";

const router = express.Router();

router.use(authenticate);

router.get("/api/server-nodes", listServerNodes);
router.get("/api/server-nodes/:id", getServerNode);
router.post("/api/server-nodes", createServerNode);
router.put("/api/server-nodes/:id", updateServerNode);
router.delete("/api/server-nodes/:id", deleteServerNode);

export default router;
