import prisma from "../lib/prisma.js";

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
    const { name, symbol, logoUrl } = req.body;
    if (!name) {
      res.status(400).json({ message: "name is required" });
      return next();
    }

    const crypto = await prisma.crypto.create({
      data: { name, symbol, logoUrl },
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

    const { name, symbol, logoUrl } = req.body;

    const crypto = await prisma.crypto.update({
      where: { id },
      data: { name, symbol, logoUrl },
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
