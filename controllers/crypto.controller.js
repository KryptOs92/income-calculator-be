import prisma from "../lib/prisma.js";

const parseIsReady = value => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return null;
};

const extractIsReady = body => {
  if (!Object.prototype.hasOwnProperty.call(body ?? {}, "isReady")) {
    return { provided: false, value: undefined };
  }
  const parsed = parseIsReady(body.isReady);
  if (parsed === null) {
    return { provided: true, error: "isReady must be a boolean value" };
  }
  return { provided: true, value: parsed };
};

export const listCryptos = async (req, res, next) => {
  try {
    const cryptos = await prisma.crypto.findMany({
      orderBy: { name: "asc" },
    });
    res.json(cryptos);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch cryptocurrencies" });
    return next();
  }
};

export const getCrypto = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ message: "Invalid crypto id" });
      return next();
    }

    const crypto = await prisma.crypto.findUnique({ where: { id } });
    if (!crypto) {
      res.status(404).json({ message: "Crypto not found" });
      return next();
    }

    res.json(crypto);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch cryptocurrency" });
    return next();
  }
};

export const createCrypto = async (req, res, next) => {
  try {
    const { name, symbol } = req.body;
    const isReadyResult = extractIsReady(req.body);

    if (isReadyResult.error) {
      res.status(400).json({ message: isReadyResult.error });
      return next();
    }

    if (!name) {
      res.status(400).json({ message: "name is required" });
      return next();
    }

    const data = { name, symbol };
    if (isReadyResult.provided) {
      data.isReady = isReadyResult.value;
    }

    const crypto = await prisma.crypto.create({
      data,
    });
    res.status(201).json(crypto);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create cryptocurrency" });
    return next();
  }
};

export const updateCrypto = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ message: "Invalid crypto id" });
      return next();
    }

    const { name, symbol } = req.body;
    const isReadyResult = extractIsReady(req.body);

    if (isReadyResult.error) {
      res.status(400).json({ message: isReadyResult.error });
      return next();
    }

    const data = { name, symbol };
    if (isReadyResult.provided) {
      data.isReady = isReadyResult.value;
    }

    const crypto = await prisma.crypto.update({
      where: { id },
      data,
    });

    res.json(crypto);
    return next();
  } catch (err) {
    if (err?.code === "P2025") {
      res.status(404).json({ message: "Crypto not found" });
      return next();
    }
    console.error(err);
    res.status(500).json({ message: "Failed to update cryptocurrency" });
    return next();
  }
};

export const deleteCrypto = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ message: "Invalid crypto id" });
      return next();
    }

    await prisma.crypto.delete({ where: { id } });
    res.status(204).send();
    return next();
  } catch (err) {
    if (err?.code === "P2025") {
      res.status(404).json({ message: "Crypto not found" });
      return next();
    }
    console.error(err);
    res.status(500).json({ message: "Failed to delete cryptocurrency" });
    return next();
  }
};
