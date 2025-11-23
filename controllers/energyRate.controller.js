import prisma from "../lib/prisma.js";

const parseId = value => {
  const id = Number(value);
  return Number.isNaN(id) ? null : id;
};

const parseDateOrNull = value => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const ensureNodeOwnership = async (serverNodeId, userId) => {
  const node = await prisma.serverNode.findFirst({
    where: { id: serverNodeId, userId, deletedAt: null },
  });
  return node;
};

export const listEnergyRates = async (req, res, next) => {
  try {
    const serverNodeId = parseId(req.query.serverNodeId);
    const userId = req.user.userId;

    if (serverNodeId !== null) {
      const owns = await ensureNodeOwnership(serverNodeId, userId);
      if (!owns) {
        res.status(404).json({ message: "Server node not found" });
        return next();
      }
    }

    const rates = await prisma.energyRate.findMany({
      where: {
        serverNode: {
          userId,
          deletedAt: null,
          ...(serverNodeId !== null ? { id: serverNodeId } : {}),
        },
      },
      orderBy: { effectiveFrom: "desc" },
    });

    res.json(rates);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch energy rates" });
    return next();
  }
};

export const getEnergyRate = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid energy rate id" });
      return next();
    }

    const rate = await prisma.energyRate.findFirst({
      where: { id, serverNode: { userId: req.user.userId, deletedAt: null } },
    });

    if (!rate) {
      res.status(404).json({ message: "Energy rate not found" });
      return next();
    }

    res.json(rate);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch energy rate" });
    return next();
  }
};

export const createEnergyRate = async (req, res, next) => {
  try {
    const { serverNodeId, costPerKwh, currency, effectiveFrom, effectiveTo } = req.body;
    const parsedNodeId = parseId(serverNodeId);
    const costValue = costPerKwh !== undefined ? costPerKwh.toString() : null;
    if (parsedNodeId === null || costValue === null) {
      res.status(400).json({ message: "serverNodeId and costPerKwh are required" });
      return next();
    }

    const node = await ensureNodeOwnership(parsedNodeId, req.user.userId);
    if (!node) {
      res.status(404).json({ message: "Server node not found" });
      return next();
    }

    const parsedEffectiveTo = parseDateOrNull(effectiveTo);
    if (effectiveTo !== undefined && parsedEffectiveTo === null) {
      res.status(400).json({ message: "effectiveTo is invalid" });
      return next();
    }

    const rate = await prisma.energyRate.create({
      data: {
        serverNodeId: parsedNodeId,
        costPerKwh: costValue,
        currency,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
        effectiveTo: parsedEffectiveTo ?? null,
      },
    });

    res.status(201).json(rate);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create energy rate" });
    return next();
  }
};

export const updateEnergyRate = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid energy rate id" });
      return next();
    }

    const rate = await prisma.energyRate.findFirst({
      where: { id, serverNode: { userId: req.user.userId, deletedAt: null } },
    });

    if (!rate) {
      res.status(404).json({ message: "Energy rate not found" });
      return next();
    }

    const { costPerKwh, currency, effectiveFrom, effectiveTo } = req.body;
    const costValue = costPerKwh !== undefined ? costPerKwh.toString() : undefined;
    const parsedEffectiveTo = parseDateOrNull(effectiveTo);
    if (effectiveTo !== undefined && parsedEffectiveTo === null) {
      res.status(400).json({ message: "effectiveTo is invalid" });
      return next();
    }

    const updated = await prisma.energyRate.update({
      where: { id },
      data: {
        costPerKwh: costValue,
        currency,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
        effectiveTo: effectiveTo !== undefined ? parsedEffectiveTo : undefined,
      },
    });

    res.json(updated);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update energy rate" });
    return next();
  }
};

export const deleteEnergyRate = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid energy rate id" });
      return next();
    }

    const rate = await prisma.energyRate.findFirst({
      where: { id, serverNode: { userId: req.user.userId, deletedAt: null } },
    });

    if (!rate) {
      res.status(404).json({ message: "Energy rate not found" });
      return next();
    }

    await prisma.energyRate.delete({ where: { id } });
    res.status(204).send();
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete energy rate" });
    return next();
  }
};
