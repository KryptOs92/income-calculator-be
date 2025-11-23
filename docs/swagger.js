import expressOasGenerator from "express-oas-generator";

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

export const initSwaggerDocs = app => {
  const swaggerHost = process.env.SWAGGER_HOST || `localhost:${process.env.PORT || 3000}`;

  expressOasGenerator.handleResponses(app, {
    predefinedSpec: spec => {
      spec.openapi = "3.0.0";
      delete spec.swagger;
      spec.servers = spec.servers || [{ url: `http://${swaggerHost}` }];
      spec.paths = spec.paths || {};
      spec.components = spec.components || {};
      spec.components.schemas = spec.components.schemas || {};
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

      const ensureSchema = (name, schema, { overwrite = false } = {}) => {
        spec.components.schemas = spec.components.schemas || {};
        if (overwrite || !spec.components.schemas[name]) {
          spec.components.schemas[name] = schema;
        }
        return { $ref: "#/components/schemas/" + name };
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

      const setJsonResponse = (operation, status, schemaRef, description = "Success") => {
        operation.responses = operation.responses || {};
        operation.responses[status] = {
          description,
          content: {
            "application/json": {
              schema: schemaRef || { type: "object" },
            },
          },
        };
      };

      const errorSchema = ensureSchema("ErrorResponse", {
        type: "object",
        properties: {
          message: { type: "string", example: "Invalid credentials" },
        },
      });

      const setSecurity = operation => {
        operation.security = [{ bearerAuth: [] }];
        operation.responses = operation.responses || {};
        operation.responses["401"] = operation.responses["401"] || {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: errorSchema,
            },
          },
        };
      };

      const setTag = (operation, tagName) => {
        spec.tags = spec.tags || [];
        if (!spec.tags.some(tag => tag.name === tagName)) {
          spec.tags.push({ name: tagName });
        }
        operation.tags = [tagName];
      };

      const userSummarySchema = ensureSchema("UserSummary", {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "John Doe" },
          email: { type: "string", example: "john@example.com" },
          emailVerified: { type: "boolean", example: false },
        },
      });

      const registerSchema = ensureSchema("RegisterResponse", {
        type: "object",
        properties: {
          message: { type: "string", example: "User created" },
          user: userSummarySchema,
        },
      });

      const loginSchema = ensureSchema("LoginResponse", {
        type: "object",
        properties: {
          token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
          tokenType: { type: "string", example: "Bearer" },
          expiresIn: { type: "string", example: "24h" },
          rememberMe: { type: "boolean", example: false },
        },
      });

      const messageSchema = ensureSchema("MessageResponse", {
        type: "object",
        properties: {
          message: { type: "string", example: "Operation completed" },
        },
      });

      const ensurePathParameter = (operation, name, schema, description) => {
        operation.parameters = operation.parameters || [];
        if (!operation.parameters.some(param => param.in === "path" && param.name === name)) {
          operation.parameters.push({
            name,
            in: "path",
            required: true,
            schema,
            description,
          });
        }
      };

      const registerOperation = ensureOperation("/api/auth/register", "post");
      setRequestBody(registerOperation, ["name", "email", "password"], {
        name: { type: "string", example: "John Doe" },
        email: { type: "string", format: "email", example: "john@example.com" },
        password: { type: "string", format: "password", example: "Password123!" },
        locale: {
          type: "string",
          example: "en",
          enum: ["it", "en"],
          description: "Lingua da usare per l'email di verifica (default: it).",
        },
      });
      setTag(registerOperation, "Auth");
      setJsonResponse(registerOperation, "201", registerSchema, "Created");
      registerOperation.responses["400"] = {
        description: "Bad Request",
        content: { "application/json": { schema: errorSchema } },
      };

      const loginOperation = ensureOperation("/api/auth/login", "post");
      setRequestBody(loginOperation, ["email", "password"], {
        email: { type: "string", format: "email", example: "john@example.com" },
        password: { type: "string", format: "password", example: "Password123!" },
        rememberMe: {
          type: "boolean",
          example: false,
          description: "Se true estende la durata del refresh token.",
        },
      });
      setTag(loginOperation, "Auth");
      setJsonResponse(loginOperation, "200", loginSchema, "Authenticated");
      loginOperation.responses["400"] = {
        description: "Bad Request",
        content: { "application/json": { schema: errorSchema } },
      };
      loginOperation.responses["401"] = {
        description: "Unauthorized",
        content: { "application/json": { schema: errorSchema } },
      };

      const refreshOperation = ensureOperation("/api/auth/refresh", "post");
      setTag(refreshOperation, "Auth");
      setJsonResponse(refreshOperation, "200", loginSchema, "Session refreshed");
      refreshOperation.responses["401"] = {
        description: "Unauthorized",
        content: { "application/json": { schema: errorSchema } },
      };

      const logoutOperation = ensureOperation("/api/auth/logout", "post");
      setTag(logoutOperation, "Auth");
      setJsonResponse(logoutOperation, "200", messageSchema, "Logged out");
      logoutOperation.responses["401"] = {
        description: "Unauthorized",
        content: { "application/json": { schema: errorSchema } },
      };

      const verifyEmailOperation = ensureOperation("/api/auth/verify-email", "get");
      verifyEmailOperation.parameters = [
        {
          name: "token",
          in: "query",
          required: true,
          schema: { type: "string" },
          description: "Token ricevuto via email",
        },
      ];
      setTag(verifyEmailOperation, "Auth");
      setJsonResponse(verifyEmailOperation, "200", messageSchema, "Email verified");
      verifyEmailOperation.responses["400"] = {
        description: "Bad Request",
        content: { "application/json": { schema: errorSchema } },
      };

      const requestResetOperation = ensureOperation("/api/auth/request-password-reset", "post");
      setRequestBody(requestResetOperation, ["email"], {
        email: { type: "string", format: "email", example: "john@example.com" },
        locale: {
          type: "string",
          example: "it",
          enum: ["it", "en"],
          description: "Lingua da usare per l'email di reset (default: it).",
        },
      });
      setTag(requestResetOperation, "Auth");
      setJsonResponse(requestResetOperation, "200", messageSchema, "Reset instructions sent");
      requestResetOperation.responses["400"] = {
        description: "Bad Request",
        content: { "application/json": { schema: errorSchema } },
      };

      const resetPasswordOperation = ensureOperation("/api/auth/reset-password", "post");
      setRequestBody(resetPasswordOperation, ["token", "password"], {
        token: { type: "string", example: "7f6658b0d..." },
        password: { type: "string", format: "password", example: "NewPassword123!" },
      });
      setTag(resetPasswordOperation, "Auth");
      setJsonResponse(resetPasswordOperation, "200", messageSchema, "Password updated");
      resetPasswordOperation.responses["400"] = {
        description: "Bad Request",
        content: { "application/json": { schema: errorSchema } },
      };

      const cryptoSchema = ensureSchema("Crypto", {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Bitcoin" },
          symbol: { type: "string", example: "BTC" },
          isReady: {
            type: "boolean",
            example: true,
            description: "Indica se la crypto è pronta ad essere utilizzata nell'app.",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T12:00:00.000Z",
          },
        },
      });

      const cryptoListSchema = ensureSchema("CryptoList", {
        type: "array",
        items: cryptoSchema,
      });

      const cryptoPayloadProperties = {
        name: { type: "string", example: "Bitcoin" },
        symbol: { type: "string", example: "BTC" },
        isReady: {
          type: "boolean",
          example: false,
          description: "Se specificato, imposta manualmente lo stato della crypto (default false).",
        },
      };

      const serverNodeSchema = ensureSchema(
        "ServerNode",
        {
          type: "object",
          properties: {
            id: { type: "integer", example: 42 },
            name: { type: "string", example: "Validator EU-1" },
            Wh: {
              type: "number",
              example: 1250.5,
              description: "Energia consumata dal nodo espressa in wattora.",
            },
            dailyUptimeSeconds: {
              type: "integer",
              example: 82800,
              description: "Tempo di attività giornaliero previsto (in secondi).",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00.000Z",
            },
          },
        },
        { overwrite: true }
      );

      const serverNodeListSchema = ensureSchema(
        "ServerNodeList",
        {
          type: "array",
          items: serverNodeSchema,
        },
        { overwrite: true }
      );

      const serverNodePayloadProperties = {
        name: { type: "string", example: "Validator EU-1" },
        Wh: {
          type: "number",
          example: 1250.5,
          description: "Energia consumata dal nodo espressa in wattora.",
        },
        dailyUptimeSeconds: {
          type: "integer",
          example: 82800,
          description: "Tempo di attività giornaliero previsto (in secondi).",
        },
      };

      const listCryptosOperation = ensureOperation("/api/cryptos", "get");
      setJsonResponse(listCryptosOperation, "200", cryptoListSchema, "List of cryptocurrencies");

      const getCryptoOperation = ensureOperation("/api/cryptos/{id}", "get");
      ensurePathParameter(getCryptoOperation, "id", { type: "integer" }, "Crypto identifier");
      setJsonResponse(getCryptoOperation, "200", cryptoSchema, "Cryptocurrency details");

      const createCryptoOperation = ensureOperation("/api/cryptos", "post");
      setRequestBody(createCryptoOperation, ["name"], cryptoPayloadProperties);
      setJsonResponse(createCryptoOperation, "201", cryptoSchema, "Cryptocurrency created");

      const updateCryptoOperation = ensureOperation("/api/cryptos/{id}", "put");
      ensurePathParameter(updateCryptoOperation, "id", { type: "integer" }, "Crypto identifier");
      setRequestBody(updateCryptoOperation, [], cryptoPayloadProperties);
      setJsonResponse(updateCryptoOperation, "200", cryptoSchema, "Cryptocurrency updated");

      const deleteCryptoOperation = ensureOperation("/api/cryptos/{id}", "delete");
      ensurePathParameter(deleteCryptoOperation, "id", { type: "integer" }, "Crypto identifier");
      deleteCryptoOperation.responses = deleteCryptoOperation.responses || {};
      deleteCryptoOperation.responses["204"] = {
        description: "Cryptocurrency deleted",
      };

      const listServerNodesOperation = ensureOperation("/api/server-nodes", "get");
      setJsonResponse(listServerNodesOperation, "200", serverNodeListSchema, "List of server nodes");

      const getServerNodeOperation = ensureOperation("/api/server-nodes/{id}", "get");
      ensurePathParameter(getServerNodeOperation, "id", { type: "integer" }, "Server node identifier");
      setJsonResponse(getServerNodeOperation, "200", serverNodeSchema, "Server node details");

      const createServerNodeOperation = ensureOperation("/api/server-nodes", "post");
      setRequestBody(
        createServerNodeOperation,
        ["name", "Wh", "dailyUptimeSeconds"],
        serverNodePayloadProperties
      );
      setJsonResponse(createServerNodeOperation, "201", serverNodeSchema, "Server node created");

      const updateServerNodeOperation = ensureOperation("/api/server-nodes/{id}", "put");
      ensurePathParameter(updateServerNodeOperation, "id", { type: "integer" }, "Server node identifier");
      setRequestBody(updateServerNodeOperation, [], serverNodePayloadProperties);
      setJsonResponse(updateServerNodeOperation, "200", serverNodeSchema, "Server node updated");

      const deleteServerNodeOperation = ensureOperation("/api/server-nodes/{id}", "delete");
      ensurePathParameter(deleteServerNodeOperation, "id", { type: "integer" }, "Server node identifier");
      deleteServerNodeOperation.responses = deleteServerNodeOperation.responses || {};
      deleteServerNodeOperation.responses["204"] = {
        description: "Server node deleted",
      };

      secureOperations.forEach(([path, method]) => {
        const op = ensureOperation(path, method);
        setSecurity(op);
        const tagName = tagMap[path];
        if (tagName) {
          setTag(op, tagName);
        }
      });

      return spec;
    },
  });
};

export const finalizeSwaggerDocs = () => {
  expressOasGenerator.handleRequests();
};
