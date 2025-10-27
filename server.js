// server.js
import dotenv from "dotenv";
import "./db.js"; // se vuoi tenere qui la connessione MySQL
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

const warmupDocsIfNeeded = async () => {
  if (process.env.NODE_ENV === "production") return;
  try {
    const { default: docsWarmup } = await import("./utils/docsWarmup.js");
    await docsWarmup(app);
  } catch (err) {
    console.warn("Impossibile generare automaticamente gli esempi per le API docs:", err.message);
  }
};

const startServer = async () => {
  await warmupDocsIfNeeded();

  app.listen(PORT, () => {
    console.log(`Server in ascolto su porta ${PORT}`);
  });
};

startServer().catch(err => {
  console.error("Errore durante l'avvio del server:", err);
});
