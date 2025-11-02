import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { sendMail } from "../lib/email.js";
import {
  buildAccountVerificationEmail,
  buildPasswordResetEmail,
} from "../lib/emailTemplates.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

export const register = async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!name || !email || !password) {
      res.status(400).json({ message: "name, email and password are required" });
      return next();
    }

    if (name.length > 100) {
      res.status(400).json({ message: "name must be at most 100 characters" });
      return next();
    }

    if (email.length > 255) {
      res.status(400).json({ message: "email must be at most 255 characters" });
      return next();
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ message: "password must be between 8 and 128 characters" });
      return next();
    }

    if (!/[A-Z]/.test(password) || !/\d/.test(password)) {
      res
        .status(400)
        .json({ message: "password must contain at least one uppercase letter and one number" });
      return next();
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ message: "Email already registered" });
      return next();
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        verificationToken,
        verificationTokenExpires,
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
      },
    });

    const verificationUrl = new URL("/verify", `${FRONTEND_URL}/`);
    verificationUrl.searchParams.set("token", verificationToken);
    const verificationLink = verificationUrl.toString();

    try {
      const { subject, text, html } = buildAccountVerificationEmail({
        locale: req.body.locale,
        name,
        verificationLink,
      });

      await sendMail({
        to: email,
        subject,
        text,
        html,
      });
    } catch (mailErr) {
      await prisma.user.delete({ where: { id: user.id } });
      console.error("Email delivery failed:", mailErr);
      res.status(500).json({ message: "Impossibile inviare l'email di verifica. Riprova più tardi." });
      return next();
    }

    res.status(201).json({
      message: "Registrazione completata. Controlla la tua email per confermare l'account.",
      user,
    });
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error while registering user" });
    return next();
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "email and password are required" });
      return next();
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return next();
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ message: "Invalid credentials" });
      return next();
    }

    if (!user.emailVerified) {
      res
        .status(403)
        .json({ message: "Email non verificata. Controlla la posta elettronica." });
      return next();
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });

    res.json({ token });
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error during login" });
    return next();
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      res.status(400).json({ message: "token is required" });
      return next();
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user || !user.verificationTokenExpires || user.verificationTokenExpires < new Date()) {
      res.status(400).json({ message: "Token non valido o scaduto" });
      return next();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    res.json({ message: "Email verificata con successo" });
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore durante la verifica dell'email" });
    return next();
  }
};

export const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ message: "email is required" });
      return next();
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.json({ message: "Se l'email è registrata riceverai un messaggio con le istruzioni." });
      return next();
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 1000 * 60 * 60);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpires: resetTokenExpires,
      },
    });

    const resetUrl = new URL("/reset-password", `${FRONTEND_URL}/`);
    resetUrl.searchParams.set("token", resetToken);
    const resetLink = resetUrl.toString();

    try {
      const { subject, text, html } = buildPasswordResetEmail({
        locale: req.body.locale,
        name: user.name,
        resetLink,
      });

      await sendMail({
        to: email,
        subject,
        text,
        html,
      });
    } catch (mailErr) {
      console.error("Password reset email delivery failed:", mailErr);
      res.status(500).json({ message: "Impossibile inviare l'email di reset. Riprova più tardi." });
      return next();
    }

    res.json({ message: "Se l'email è registrata riceverai un messaggio con le istruzioni." });
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore durante la richiesta di reset password" });
    return next();
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ message: "token e password sono obbligatori" });
      return next();
    }

    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token },
    });

    if (
      !user ||
      !user.passwordResetTokenExpires ||
      user.passwordResetTokenExpires < new Date()
    ) {
      res.status(400).json({ message: "Token non valido o scaduto" });
      return next();
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
      },
    });

    res.json({ message: "Password aggiornata con successo" });
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore durante il reset della password" });
    return next();
  }
};
