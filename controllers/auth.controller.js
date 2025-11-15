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
const ACCESS_TOKEN_EXPIRATION = process.env.ACCESS_TOKEN_EXPIRATION || "24h";
const REFRESH_TOKEN_TTL_HOURS = Number(process.env.REFRESH_TOKEN_TTL_HOURS || 24);
const REFRESH_TOKEN_REMEMBER_TTL_DAYS = Number(process.env.REFRESH_TOKEN_REMEMBER_TTL_DAYS || 30);
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refreshToken";
const REFRESH_COOKIE_PATH = process.env.REFRESH_COOKIE_PATH || "/api/auth";
const REFRESH_COOKIE_DOMAIN = process.env.REFRESH_COOKIE_DOMAIN || undefined;
const allowedSameSite = ["lax", "strict", "none"];
const REFRESH_COOKIE_SAMESITE = (() => {
  const raw = (process.env.REFRESH_COOKIE_SAMESITE || "lax").toLowerCase();
  return allowedSameSite.includes(raw) ? raw : "lax";
})();
const COOKIE_SECURE =
  process.env.REFRESH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

if (REFRESH_COOKIE_SAMESITE === "none" && !COOKIE_SECURE) {
  console.warn(
    "Refresh token cookie è configurato con SameSite=None ma senza Secure; alcuni browser potrebbero rifiutarlo in HTTP.",
  );
}

const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

const computeRefreshTtlMs = rememberMe => {
  const shortMs =
    Number.isFinite(REFRESH_TOKEN_TTL_HOURS) && REFRESH_TOKEN_TTL_HOURS > 0
      ? REFRESH_TOKEN_TTL_HOURS * HOURS
      : 24 * HOURS;
  const longMs =
    Number.isFinite(REFRESH_TOKEN_REMEMBER_TTL_DAYS) && REFRESH_TOKEN_REMEMBER_TTL_DAYS > 0
      ? REFRESH_TOKEN_REMEMBER_TTL_DAYS * DAYS
      : 30 * DAYS;
  return rememberMe ? longMs : shortMs;
};

const hashToken = token => crypto.createHash("sha256").update(token).digest("hex");

const baseRefreshCookieOptions = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: REFRESH_COOKIE_SAMESITE,
  path: REFRESH_COOKIE_PATH,
  ...(REFRESH_COOKIE_DOMAIN ? { domain: REFRESH_COOKIE_DOMAIN } : {}),
};

const buildRefreshCookieOptions = ttlMs => ({
  ...baseRefreshCookieOptions,
  maxAge: ttlMs,
});

const clearRefreshCookie = res => {
  res.clearCookie(REFRESH_COOKIE_NAME, baseRefreshCookieOptions);
};

const issueAccessToken = userId =>
  jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });

const parseRememberMe = value => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return false;
};

const createRefreshTokenRecord = async ({ userId, rememberMe, userAgent, ipAddress }) => {
  const refreshToken = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashToken(refreshToken);
  const ttlMs = computeRefreshTtlMs(rememberMe);
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      rememberMe,
      expiresAt,
      userAgent: userAgent ? userAgent.slice(0, 255) : null,
      ipAddress: ipAddress ? ipAddress.slice(0, 45) : null,
    },
  });

  return { refreshToken, ttlMs, expiresAt };
};

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

    const verificationUrl = new URL("/verify-email", `${FRONTEND_URL}/`);
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
      res
        .status(500)
        .json({ message: "Impossibile inviare l'email di verifica. Riprova più tardi." });
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
    const rememberMe = parseRememberMe(req.body?.rememberMe);

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

    const accessToken = issueAccessToken(user.id);
    const { refreshToken, ttlMs } = await createRefreshTokenRecord({
      userId: user.id,
      rememberMe,
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, buildRefreshCookieOptions(ttlMs));
    res.json({
      token: accessToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_EXPIRATION,
      rememberMe,
    });
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error during login" });
    return next();
  }
};

export const refreshSession = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      res.status(401).json({ message: "Refresh token mancante" });
      return next();
    }

    const tokenHash = hashToken(rawToken);
    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !existing ||
      existing.revokedAt ||
      !existing.user ||
      existing.expiresAt < new Date()
    ) {
      clearRefreshCookie(res);
      res.status(401).json({ message: "Refresh token non valido o scaduto" });
      return next();
    }

    const rememberMe = existing.rememberMe;
    const newRefreshToken = crypto.randomBytes(64).toString("hex");
    const newHash = hashToken(newRefreshToken);
    const ttlMs = computeRefreshTtlMs(rememberMe);
    const expiresAt = new Date(Date.now() + ttlMs);

    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: {
        tokenHash: newHash,
        expiresAt,
        revokedAt: null,
        rememberMe,
        userAgent: req.get("user-agent") ? req.get("user-agent").slice(0, 255) : existing.userAgent,
        ipAddress: req.ip ? req.ip.slice(0, 45) : existing.ipAddress,
      },
    });

    const accessToken = issueAccessToken(existing.user.id);
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, buildRefreshCookieOptions(ttlMs));
    res.json({
      token: accessToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_EXPIRATION,
      rememberMe,
    });
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore durante il refresh della sessione" });
    return next();
  }
};

export const logout = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      try {
        await prisma.refreshToken.update({
          where: { tokenHash },
          data: { revokedAt: new Date() },
        });
      } catch (err) {
        // token already removed or invalid - ignore
      }
    }

    clearRefreshCookie(res);
    res.json({ message: "Logout effettuato con successo" });
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore durante il logout" });
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

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetTokenExpires: null,
        },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { revokedAt: new Date() },
      }),
    ]);

    res.json({ message: "Password aggiornata con successo" });
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore durante il reset della password" });
    return next();
  }
};
