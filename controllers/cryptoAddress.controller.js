import prisma from "../lib/prisma.js";

const parseId = value => {
  const id = Number(value);
  return Number.isNaN(id) ? null : id;
};

export const listCryptoAddresses = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const addresses = await prisma.userCryptoAddress.findMany({
      where: { userId },
      include: { crypto: true, inflows: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(addresses);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch crypto addresses" });
    return next();
  }
};

export const getCryptoAddress = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid address id" });
      return next();
    }

    const address = await prisma.userCryptoAddress.findFirst({
      where: { id, userId: req.user.userId },
      include: { crypto: true, inflows: true },
    });

    if (!address) {
      res.status(404).json({ message: "Address not found" });
      return next();
    }

    res.json(address);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch crypto address" });
    return next();
  }
};

export const createCryptoAddress = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { cryptoId, address, label } = req.body;

    const parsedCryptoId = parseId(cryptoId);
    if (parsedCryptoId === null || !address) {
      res.status(400).json({ message: "cryptoId and address are required" });
      return next();
    }

    const cryptoExists = await prisma.crypto.count({ where: { id: parsedCryptoId } });
    if (!cryptoExists) {
      res.status(400).json({ message: "cryptoId does not exist" });
      return next();
    }

    const created = await prisma.userCryptoAddress.create({
      data: {
        userId,
        cryptoId: parsedCryptoId,
        address,
        label,
      },
    });

    res.status(201).json(created);
    return next();
  } catch (err) {
    if (err?.code === "P2002") {
      res.status(409).json({ message: "Address already exists" });
      return next();
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create crypto address" });
    return next();
  }
};

export const updateCryptoAddress = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid address id" });
      return next();
    }

    const { label } = req.body;

    const address = await prisma.userCryptoAddress.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!address) {
      res.status(404).json({ message: "Address not found" });
      return next();
    }

    const updated = await prisma.userCryptoAddress.update({
      where: { id },
      data: { label: label ?? address.label },
    });

    res.json(updated);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update crypto address" });
    return next();
  }
};

export const deleteCryptoAddress = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid address id" });
      return next();
    }

    const address = await prisma.userCryptoAddress.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!address) {
      res.status(404).json({ message: "Address not found" });
      return next();
    }

    await prisma.userCryptoAddress.delete({ where: { id } });
    res.status(204).send();
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete crypto address" });
    return next();
  }
};
