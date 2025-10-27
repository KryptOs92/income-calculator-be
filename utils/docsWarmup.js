import request from "supertest";

// Sends sample requests so express-oas-generator can capture payloads without manual calls.
const docsWarmup = async app => {
  const timestamp = Date.now();
  const sampleUser = {
    name: "Docs Preview User",
    email: `docs-${timestamp}@example.com`,
    password: "Password123!",
  };

  try {
    await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send(sampleUser);
  } catch (err) {
    console.warn("Doc warmup register failed (expected in repeated runs):", err.message);
  }

  try {
    await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: sampleUser.email, password: sampleUser.password });
  } catch (err) {
    console.warn("Doc warmup login failed:", err.message);
  }
};

export default docsWarmup;
