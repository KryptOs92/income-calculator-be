import mysql from "mysql2";
import dotenv from "dotenv";

// Load environment variables before establishing the connection
dotenv.config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

connection.connect(err => {
  if (err) {
    console.error("Errore di connessione al database:", err);
  } else {
    console.log("Connessione MySQL riuscita.");
  }
});

export default connection;
