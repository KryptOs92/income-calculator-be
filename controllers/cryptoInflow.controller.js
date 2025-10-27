import prisma from "../lib/prisma.js";

const parseId = value => {
  const id = Number(value);
  return Number.isNaN(id) ? null : id;
};

const toDecimalInput = value => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" || typeof value === "string") {
    return value.toString();
  }
  return undefined;
};

export const listCryptoInflows = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const addressId = parseId(req.query.addressId);

    const inflows = await prisma.cryptoInflow.findMany({
      where: {
        address: {
          userId,
          ...(addressId !== null ? { id: addressId } : {}),
        },
      },
      orderBy: { detectedAt: "desc" },
      include: {
        address: {
          include: { crypto: true },
        },
      },
    });

    res.json(inflows);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch crypto inflows" });
    return next();
  }
};

export const getCryptoInflow = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid inflow id" });
      return next();
    }

    const inflow = await prisma.cryptoInflow.findFirst({
      where: { id, address: { userId: req.user.userId } },
      include: {
        address: {
          include: { crypto: true },
        },
      },
    });

    if (!inflow) {
      res.status(404).json({ message: "Inflow not found" });
      return next();
    }

    res.json(inflow);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch crypto inflow" });
    return next();
  }
};

export const createCryptoInflow = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      addressId,
      txHash,
      amount,
      detectedAt,
      fiatValue,
      fiatCurrency,
      priceSource,
      priceTimestamp,
    } = req.body;

    const parsedAddressId = parseId(addressId);
    if (parsedAddressId === null || amount === undefined) {
      res.status(400).json({ message: "addressId and amount are required" });
      return next();
    }

    const address = await prisma.userCryptoAddress.findFirst({
      where: { id: parsedAddressId, userId },
    });
    if (!address) {
      res.status(404).json({ message: "Address not found" });
      return next();
    }

    const inflow = await prisma.cryptoInflow.create({
      data: {
        addressId: parsedAddressId,
        txHash,
        amount: toDecimalInput(amount),
        detectedAt: detectedAt ? new Date(detectedAt) : undefined,
        fiatValue: toDecimalInput(fiatValue),
        fiatCurrency,
        priceSource,
        priceTimestamp: priceTimestamp ? new Date(priceTimestamp) : undefined,
      },
    });

    res.status(201).json(inflow);
    return next();
  } catch (err) {
    if (err?.code === "P2002") {
      res.status(409).json({ message: "Inflow with this txHash already exists" });
      return next();
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create crypto inflow" });
    return next();
  }
};

export const updateCryptoInflow = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid inflow id" });
      return next();
    }

    const inflow = await prisma.cryptoInflow.findFirst({
      where: { id, address: { userId: req.user.userId } },
    });

    if (!inflow) {
      res.status(404).json({ message: "Inflow not found" });
      return next();
    }

    const {
      amount,
      detectedAt,
      fiatValue,
      fiatCurrency,
      priceSource,
      priceTimestamp,
    } = req.body;

    const updated = await prisma.cryptoInflow.update({
      where: { id },
      data: {
        amount: amount !== undefined ? toDecimalInput(amount) : undefined,
        detectedAt: detectedAt ? new Date(detectedAt) : undefined,
        fiatValue: fiatValue !== undefined ? toDecimalInput(fiatValue) : undefined,
        fiatCurrency,
        priceSource,
        priceTimestamp: priceTimestamp ? new Date(priceTimestamp) : undefined,
      },
    });

    res.json(updated);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update crypto inflow" });
    return next();
  }
};

export const deleteCryptoInflow = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid inflow id" });
      return next();
    }

    const inflow = await prisma.cryptoInflow.findFirst({
      where: { id, address: { userId: req.user.userId } },
    });

    if (!inflow) {
      res.status(404).json({ message: "Inflow not found" });
      return next();
    }

    await prisma.cryptoInflow.delete({ where: { id } });
    res.status(204).send();
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete crypto inflow" });
    return next();
  }
};
