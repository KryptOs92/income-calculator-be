import express from "express";
import expressOasGenerator from "express-oas-generator";
import authRoutes from "./routes/auth.routes.js";
import cryptoRoutes from "./routes/crypto.routes.js";
import cryptoAddressRoutes from "./routes/cryptoAddress.routes.js";
import cryptoInflowRoutes from "./routes/cryptoInflow.routes.js";
import serverNodeRoutes from "./routes/serverNode.routes.js";
import energyRateRoutes from "./routes/energyRate.routes.js";
import { authenticate } from "./middlewares/auth.middlewares.js";

const app = express();
app._router = app.router; // ensure compatibility with libs expecting Express 4 internals

const swaggerHost = process.env.SWAGGER_HOST || `localhost:${process.env.PORT || 3000}`;
expressOasGenerator.handleResponses(app, {
  predefinedSpec: spec => {
    spec.host = swaggerHost;
    spec.schemes = spec.schemes || ["http"];
    spec.paths = spec.paths || {};
    spec.components = spec.components || {};
    spec.components.securitySchemes = spec.components.securitySchemes || {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    };

    const ensureOperation = (path, method) => {
      spec.paths[path] = spec.paths[path] || {};
      spec.paths[path][method] = spec.paths[path][method] || { responses: {} };
      return spec.paths[path][method];
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

    const setSecurity = operation => {
      operation.security = [{ bearerAuth: [] }];
    };

    const setTag = (operation, tagName) => {
      spec.tags = spec.tags || [];
      if (!spec.tags.some(tag => tag.name === tagName)) {
        spec.tags.push({ name: tagName });
      }
      operation.tags = [tagName];
    };

    const registerOperation = ensureOperation("/api/auth/register", "post");
    setRequestBody(registerOperation, ["name", "email", "password"], {
      name: { type: "string", example: "John Doe" },
      email: { type: "string", format: "email", example: "john@example.com" },
      password: { type: "string", format: "password", example: "Password123!" },
    });
    setTag(registerOperation, "Auth");

    const loginOperation = ensureOperation("/api/auth/login", "post");
    setRequestBody(loginOperation, ["email", "password"], {
      email: { type: "string", format: "email", example: "john@example.com" },
      password: { type: "string", format: "password", example: "Password123!" },
    });
    setTag(loginOperation, "Auth");

    const secureOperations = [
      ["/api/cryptos", "get"],
      ["/api/cryptos", "post"],
      ["/api/cryptos/{id}", "get"],
      ["/api/cryptos/{id}", "put"],
      ["/api/cryptos/{id}", "delete"],
      ["/api/crypto-addresses", "get"],
      ["/api/crypto-addresses", "post"],
      ["/api/crypto-addresses/{id}", "get"],
      ["/api/crypto-addresses/{id}", "put"],
      ["/api/crypto-addresses/{id}", "delete"],
      ["/api/crypto-inflows", "get"],
      ["/api/crypto-inflows", "post"],
      ["/api/crypto-inflows/{id}", "get"],
      ["/api/crypto-inflows/{id}", "put"],
      ["/api/crypto-inflows/{id}", "delete"],
      ["/api/server-nodes", "get"],
      ["/api/server-nodes", "post"],
      ["/api/server-nodes/{id}", "get"],
      ["/api/server-nodes/{id}", "put"],
      ["/api/server-nodes/{id}", "delete"],
      ["/api/energy-rates", "get"],
      ["/api/energy-rates", "post"],
      ["/api/energy-rates/{id}", "get"],
      ["/api/energy-rates/{id}", "put"],
      ["/api/energy-rates/{id}", "delete"],
    ];

    const tagMap = {
      "/api/cryptos": "Cryptos",
      "/api/cryptos/{id}": "Cryptos",
      "/api/crypto-addresses": "Crypto Addresses",
      "/api/crypto-addresses/{id}": "Crypto Addresses",
      "/api/crypto-inflows": "Crypto Inflows",
      "/api/crypto-inflows/{id}": "Crypto Inflows",
      "/api/server-nodes": "Server Nodes",
      "/api/server-nodes/{id}": "Server Nodes",
      "/api/energy-rates": "Energy Rates",
      "/api/energy-rates/{id}": "Energy Rates",
    };

    secureOperations.forEach(([path, method]) => {
      const op = ensureOperation(path, method);
      setSecurity(op);
      const tagName = tagMap[path];
      if (tagName) {
        setTag(op, tagName);
      }
    });

    const cryptoCreate = ensureOperation("/api/cryptos", "post");
    setRequestBody(cryptoCreate, ["name"], {
      name: { type: "string", example: "Bitcoin" },
      symbol: { type: "string", example: "BTC" },
      logoUrl: { type: "string", format: "uri", example: "https://cdn.example/btc.png" },
    });
    setTag(cryptoCreate, "Cryptos");

    const cryptoUpdate = ensureOperation("/api/cryptos/{id}", "put");
    setRequestBody(cryptoUpdate, [], {
      name: { type: "string", example: "Bitcoin" },
      symbol: { type: "string", example: "BTC" },
      logoUrl: { type: "string", format: "uri", example: "https://cdn.example/btc.png" },
    });
    setTag(cryptoUpdate, "Cryptos");

    const addressCreate = ensureOperation("/api/crypto-addresses", "post");
    setRequestBody(addressCreate, ["cryptoId", "address"], {
      cryptoId: { type: "integer", example: 1 },
      address: { type: "string", example: "0x1234abcd" },
      label: { type: "string", example: "Cold wallet" },
    });
    setTag(addressCreate, "Crypto Addresses");

    const addressUpdate = ensureOperation("/api/crypto-addresses/{id}", "put");
    setRequestBody(addressUpdate, [], {
      label: { type: "string", example: "My Ledger" },
    });
    setTag(addressUpdate, "Crypto Addresses");

    const inflowCreate = ensureOperation("/api/crypto-inflows", "post");
    setRequestBody(inflowCreate, ["addressId", "amount"], {
      addressId: { type: "integer", example: 42 },
      amount: { type: "string", example: "0.5" },
      txHash: { type: "string", example: "0xabc123" },
      detectedAt: { type: "string", format: "date-time" },
      fiatValue: { type: "string", example: "1200.50" },
      fiatCurrency: { type: "string", example: "USD" },
      priceSource: { type: "string", example: "coinmarketcap" },
      priceTimestamp: { type: "string", format: "date-time" },
    });
    setTag(inflowCreate, "Crypto Inflows");

    const inflowUpdate = ensureOperation("/api/crypto-inflows/{id}", "put");
    setRequestBody(inflowUpdate, [], {
      amount: { type: "string", example: "0.75" },
      detectedAt: { type: "string", format: "date-time" },
      fiatValue: { type: "string", example: "1500.00" },
      fiatCurrency: { type: "string", example: "USD" },
      priceSource: { type: "string", example: "coinmarketcap" },
      priceTimestamp: { type: "string", format: "date-time" },
    });
    setTag(inflowUpdate, "Crypto Inflows");

    const nodeCreate = ensureOperation("/api/server-nodes", "post");
    setRequestBody(nodeCreate, ["name", "powerKw", "dailyUptimeSeconds"], {
      name: { type: "string", example: "Node A" },
      powerKw: { type: "number", example: 1.2 },
      dailyUptimeSeconds: { type: "integer", example: 36000 },
    });
    setTag(nodeCreate, "Server Nodes");

    const nodeUpdate = ensureOperation("/api/server-nodes/{id}", "put");
    setRequestBody(nodeUpdate, [], {
      name: { type: "string", example: "Node A" },
      powerKw: { type: "number", example: 1.4 },
      dailyUptimeSeconds: { type: "integer", example: 40000 },
    });
    setTag(nodeUpdate, "Server Nodes");

    const rateCreate = ensureOperation("/api/energy-rates", "post");
    setRequestBody(rateCreate, ["serverNodeId", "costPerKwh"], {
      serverNodeId: { type: "integer", example: 7 },
      costPerKwh: { type: "string", example: "0.23" },
      currency: { type: "string", example: "EUR" },
      effectiveFrom: { type: "string", format: "date-time" },
      effectiveTo: { type: "string", format: "date-time" },
    });
    setTag(rateCreate, "Energy Rates");

    const rateUpdate = ensureOperation("/api/energy-rates/{id}", "put");
    setRequestBody(rateUpdate, [], {
      costPerKwh: { type: "string", example: "0.25" },
      currency: { type: "string", example: "EUR" },
      effectiveFrom: { type: "string", format: "date-time" },
      effectiveTo: { type: "string", format: "date-time" },
    });
    setTag(rateUpdate, "Energy Rates");

    return spec;
  },
});
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

// esempio di rotta protetta
app.get("/api/profile", authenticate, (req, res) => {
  res.json({ message: "Benvenuto!", userId: req.user.userId });
});

expressOasGenerator.handleRequests();

export default app;
