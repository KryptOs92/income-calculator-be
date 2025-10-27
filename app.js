import express from "express";
import authRoutes from "./routes/auth.routes.js";
import cryptoRoutes from "./routes/crypto.routes.js";
import cryptoAddressRoutes from "./routes/cryptoAddress.routes.js";
import cryptoInflowRoutes from "./routes/cryptoInflow.routes.js";
import serverNodeRoutes from "./routes/serverNode.routes.js";
import energyRateRoutes from "./routes/energyRate.routes.js";
import { authenticate } from "./middlewares/auth.middlewares.js";
import { initSwaggerDocs, finalizeSwaggerDocs } from "./docs/swagger.js";

const app = express();
app._router = app.router; // compatibility with libs expecting Express 4 internals

initSwaggerDocs(app);

app.use(express.json());

app.use(authRoutes);
app.use(cryptoRoutes);
app.use(cryptoAddressRoutes);
app.use(cryptoInflowRoutes);
app.use(serverNodeRoutes);
app.use(energyRateRoutes);

app.get("/api-docs", (_req, res) => {
  res.redirect("/api-docs/v3");
});

app.get("/api/profile", authenticate, (req, res) => {
  res.json({ message: "Benvenuto!", userId: req.user.userId });
});

finalizeSwaggerDocs();

export default app;
