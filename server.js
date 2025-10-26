import express from "express";
import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Connessione al database
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// Test connessione
db.connect(err => {
  if (err) {
    console.error("❌ Errore di connessione al database:", err);
  } else {
    console.log("✅ Connessione MySQL riuscita!");
  }
});

// Route base
app.get("/", (req, res) => {
  res.send("Server Express connesso a MySQL!");
});

// Avvio server
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server in ascolto su porta ${process.env.PORT}`);
});
