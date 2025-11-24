import prisma from "../lib/prisma.js";

const parseId = value => {
  const id = Number(value);
  return Number.isNaN(id) ? null : id;
};

const parseDate = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildPagination = (page, perPage) => {
  if (page === undefined && perPage === undefined) return null;
  const parsedPage = Number(page);
  const parsedPerPage = Number(perPage);
  if (
    !Number.isInteger(parsedPage) ||
    parsedPage <= 0 ||
    !Number.isInteger(parsedPerPage) ||
    parsedPerPage <= 0
  ) {
    return "invalid";
  }
  return { skip: (parsedPage - 1) * parsedPerPage, take: parsedPerPage };
};

const minusOneDay = date => new Date(date.getTime() - 24 * 60 * 60 * 1000);

const ensureNodeOwnership = async (serverNodeId, userId) => {
  const node = await prisma.serverNode.findFirst({
    where: { id: serverNodeId, userId, deletedAt: null },
  });
  return node;
};

const findConflictAt = (serverNodeId, effectiveFrom, excludeId) =>
  prisma.energyRate.findFirst({
    where: {
      serverNodeId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      effectiveFrom: { lte: effectiveFrom },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

const hasRangeOverlap = (serverNodeId, effectiveFrom, effectiveTo, excludeId) =>
  prisma.energyRate.findFirst({
    where: {
      serverNodeId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      effectiveFrom: { lt: effectiveTo },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
    },
  });

export const listEnergyRates = async (req, res, next) => {
  try {
    const serverNodeId = parseId(req.query.serverNodeId);
    const userId = req.user.userId;

    const pagination = buildPagination(req.query.page, req.query.perPage);
    if (pagination === "invalid") {
      res.status(400).json({ message: "page and perPage must be positive integers" });
      return next();
    }

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
      orderBy: [{ effectiveTo: "desc" }, { effectiveFrom: "desc" }],
      ...(pagination ?? {}),
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

    const parsedFromInput = parseDate(effectiveFrom);
    const parsedTo = parseDate(effectiveTo);
    if (effectiveFrom !== undefined && !parsedFromInput) {
      res.status(400).json({ message: "effectiveFrom is invalid" });
      return next();
    }
    if (effectiveTo !== undefined && effectiveTo !== null && !parsedTo) {
      res.status(400).json({ message: "effectiveTo is invalid" });
      return next();
    }

    const from = parsedFromInput ?? new Date();
    const to = parsedTo ?? null;
    if (to && from >= to) {
      res.status(400).json({ message: "effectiveTo must be after effectiveFrom" });
      return next();
    }

    if (to === null) {
      const conflict = await findConflictAt(parsedNodeId, from);
      if (conflict) {
        if (from <= conflict.effectiveFrom) {
          res.status(409).json({ message: "effectiveFrom must be after the current open period start" });
          return next();
        }
        await prisma.energyRate.update({
          where: { id: conflict.id },
          data: { effectiveTo: minusOneDay(from) },
        });
      }
    } else {
      const overlap = await hasRangeOverlap(parsedNodeId, from, to);
      if (overlap) {
        res.status(409).json({ message: "An energy rate already exists for the provided time range" });
        return next();
      }
    }

    const rate = await prisma.energyRate.create({
      data: {
        serverNodeId: parsedNodeId,
        costPerKwh: costValue,
        currency,
        effectiveFrom: from,
        effectiveTo: to,
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
