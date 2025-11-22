import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Token mancante" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token mancante" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.userId) {
      return res.status(401).json({ message: "Token non valido o scaduto" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Utente non trovato" });
    }

    req.user = decoded;
    req.user.userId = user.id;
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    res.status(401).json({ message: "Token non valido o scaduto" });
  }
};
