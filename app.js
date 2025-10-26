import express from "express";
import expressOasGenerator from "express-oas-generator";
import authRoutes from "./routes/auth.routes.js";
import { authenticate } from "./middlewares/auth.middlewares.js";

const app = express();
expressOasGenerator.handleResponses(app, {});
app.use(express.json());

app.use("/api/auth", authRoutes);

// esempio di rotta protetta
app.get("/api/profile", authenticate, (req, res) => {
  res.json({ message: "Benvenuto!", userId: req.user.userId });
});

expressOasGenerator.handleRequests();

export default app;
