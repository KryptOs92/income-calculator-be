import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { sendMail } from "../lib/email.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const EMAIL_VERIFICATION_URL =
  process.env.EMAIL_VERIFICATION_URL || `${APP_BASE_URL}/api/auth/verify-email`;
const PASSWORD_RESET_URL =
  process.env.PASSWORD_RESET_URL || `${APP_BASE_URL}/reset-password`;

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: "name, email and password are required" });
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

    const verificationLink = `${EMAIL_VERIFICATION_URL}?token=${verificationToken}`;

    try {
      await sendMail({
        to: email,
        subject: "Conferma la tua registrazione",
        text: `Ciao ${name},\n\nPer completare la registrazione clicca sul link: ${verificationLink}\n\nSe non hai richiesto questo account, ignora questa email.`,
        html: `<p>Ciao ${name},</p><p>Per completare la registrazione clicca sul seguente link:</p><p><a href="${verificationLink}">${verificationLink}</a></p><p>Se non hai richiesto questo account, ignora questa email.</p>`,
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

    const resetLink = `${PASSWORD_RESET_URL}?token=${resetToken}`;

    try {
      await sendMail({
        to: email,
        subject: "Reset della password",
        text: `Ciao ${user.name},\n\nPer reimpostare la password clicca sul link: ${resetLink}\nQuesto link scadrà tra 1 ora.\n\nSe non hai richiesto il reset, ignora questa email.`,
        html: `<p>Ciao ${user.name},</p><p>Per reimpostare la password clicca sul seguente link (valido 1 ora):</p><p><a href="${resetLink}">${resetLink}</a></p><p>Se non hai richiesto il reset, ignora questa email.</p>`,
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
