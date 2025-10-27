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
    spec.paths = spec.paths || {};

    const ensureOperation = path => {
      spec.paths[path] = spec.paths[path] || {};
      spec.paths[path].post = spec.paths[path].post || { responses: {} };
      return spec.paths[path].post;
    };

    const setRequestBody = (operation, required, properties) => {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required,
              properties,
            },
          },
        },
      };
    };

    const registerOperation = ensureOperation("/api/auth/register");
    setRequestBody(registerOperation, ["name", "email", "password"], {
      name: { type: "string", example: "John Doe" },
      email: { type: "string", format: "email", example: "john@example.com" },
      password: { type: "string", format: "password", example: "Password123!" },
    });

    const loginOperation = ensureOperation("/api/auth/login");
    setRequestBody(loginOperation, ["email", "password"], {
      email: { type: "string", format: "email", example: "john@example.com" },
      password: { type: "string", format: "password", example: "Password123!" },
    });

    return spec;
  },
});
app.use(express.json());

app.use(authRoutes);

app.get("/api-docs", (_req, res) => {
  res.redirect("/api-docs/v3");
});

// esempio di rotta protetta
app.get("/api/profile", authenticate, (req, res) => {
  res.json({ message: "Benvenuto!", userId: req.user.userId });
});

expressOasGenerator.handleRequests();

export default app;
