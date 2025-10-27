import express from "express";
import expressOasGenerator from "express-oas-generator";
import authRoutes from "./routes/auth.routes.js";
import { authenticate } from "./middlewares/auth.middlewares.js";

const app = express();
app._router = app.router; // ensure compatibility with libs expecting Express 4 internals

const swaggerHost = process.env.SWAGGER_HOST || `localhost:${process.env.PORT || 3000}`;
expressOasGenerator.handleResponses(app, {
  predefinedSpec: spec => {
    spec.host = swaggerHost;
    spec.schemes = spec.schemes || ["http"];
    return spec;
  },
});
app.use(express.json());

app.use(authRoutes);

// esempio di rotta protetta
app.get("/api/profile", authenticate, (req, res) => {
  res.json({ message: "Benvenuto!", userId: req.user.userId });
});

expressOasGenerator.handleRequests();

export default app;
