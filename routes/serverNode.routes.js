import express from "express";
import {
  listServerNodes,
  listDeletedServerNodes,
  getServerNode,
  activateServerNode,
  createServerNode,
  updateServerNode,
  deleteServerNode,
} from "../controllers/serverNode.controller.js";
import { authenticate } from "../middlewares/auth.middlewares.js";

const router = express.Router();

router.get("/api/server-nodes", authenticate, listServerNodes);
router.get("/api/server-nodes/deleted", authenticate, listDeletedServerNodes);
router.get("/api/server-nodes/:id", authenticate, getServerNode);
router.post("/api/server-nodes/:id/activate", authenticate, activateServerNode);
router.post("/api/server-nodes", authenticate, createServerNode);
router.put("/api/server-nodes/:id", authenticate, updateServerNode);
router.delete("/api/server-nodes/:id", authenticate, deleteServerNode);

export default router;
