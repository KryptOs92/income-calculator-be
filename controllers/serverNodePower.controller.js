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

const minusOneMillisecond = date => new Date(date.getTime() - 1);

const ensureNodeOwnership = async (serverNodeId, userId) => {
  return prisma.serverNode.findFirst({ where: { id: serverNodeId, userId } });
};

const findConflictAt = (serverNodeId, effectiveFrom, excludeId) =>
  prisma.serverNodePower.findFirst({
    where: {
      serverNodeId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      effectiveFrom: { lte: effectiveFrom },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

const hasRangeOverlap = (serverNodeId, effectiveFrom, effectiveTo, excludeId) =>
  prisma.serverNodePower.findFirst({
    where: {
      serverNodeId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      effectiveFrom: { lt: effectiveTo },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
    },
  });

export const listServerNodePowers = async (req, res, next) => {
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

    const entries = await prisma.serverNodePower.findMany({
      where: {
        serverNode: {
          userId,
          ...(serverNodeId !== null ? { id: serverNodeId } : {}),
        },
      },
      orderBy: { effectiveFrom: "desc" },
    });

    res.json(entries);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch server node power history" });
    return next();
  }
};

export const getServerNodePower = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid power entry id" });
      return next();
    }

    const entry = await prisma.serverNodePower.findFirst({
      where: { id, serverNode: { userId: req.user.userId } },
    });

    if (!entry) {
      res.status(404).json({ message: "Power entry not found" });
      return next();
    }

    res.json(entry);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch power entry" });
    return next();
  }
};

export const createServerNodePower = async (req, res, next) => {
  try {
    const { serverNodeId, Wh: wh, effectiveFrom, effectiveTo } = req.body;
    const parsedNodeId = parseId(serverNodeId);
    const parsedPower = Number(wh);
    if (parsedNodeId === null || Number.isNaN(parsedPower)) {
      res.status(400).json({ message: "serverNodeId and Wh are required and must be valid" });
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
        await prisma.serverNodePower.update({
          where: { id: conflict.id },
          data: { effectiveTo: minusOneMillisecond(from) },
        });
      }
    } else {
      const overlap = await hasRangeOverlap(parsedNodeId, from, to);
      if (overlap) {
        res.status(409).json({ message: "A power entry already exists for the provided time range" });
        return next();
      }
    }

    const created = await prisma.serverNodePower.create({
      data: {
        serverNodeId: parsedNodeId,
        Wh: parsedPower,
        effectiveFrom: from,
        effectiveTo: to,
      },
    });

    res.status(201).json(created);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create power entry" });
    return next();
  }
};

export const updateServerNodePower = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid power entry id" });
      return next();
    }

    const existing = await prisma.serverNodePower.findFirst({
      where: { id, serverNode: { userId: req.user.userId } },
    });

    if (!existing) {
      res.status(404).json({ message: "Power entry not found" });
      return next();
    }

    const { Wh: wh, effectiveFrom, effectiveTo } = req.body;
    const data = {};

    if (wh !== undefined) {
      const parsedPower = Number(wh);
      if (Number.isNaN(parsedPower)) {
        res.status(400).json({ message: "Wh must be a number" });
        return next();
      }
      data.Wh = parsedPower;
    }

    const from = effectiveFrom !== undefined ? parseDate(effectiveFrom) : existing.effectiveFrom;
    const to =
      effectiveTo !== undefined
        ? effectiveTo === null
          ? null
          : parseDate(effectiveTo)
        : existing.effectiveTo;

    if (from === null || Number.isNaN(from?.getTime?.())) {
      res.status(400).json({ message: "effectiveFrom is invalid" });
      return next();
    }

    if (to && from >= to) {
      res.status(400).json({ message: "effectiveTo must be after effectiveFrom" });
      return next();
    }

    data.effectiveFrom = from;
    data.effectiveTo = to ?? null;

    if (to === null) {
      const conflict = await findConflictAt(existing.serverNodeId, from, existing.id);
      if (conflict) {
        if (from <= conflict.effectiveFrom) {
          res
            .status(409)
            .json({ message: "effectiveFrom must be after the current open period start" });
          return next();
        }
        await prisma.serverNodePower.update({
          where: { id: conflict.id },
          data: { effectiveTo: minusOneMillisecond(from) },
        });
      }
    } else {
      const overlap = await hasRangeOverlap(existing.serverNodeId, from, to, existing.id);
      if (overlap) {
        res.status(409).json({ message: "A power entry already exists for the provided time range" });
        return next();
      }
    }

    const updated = await prisma.serverNodePower.update({
      where: { id },
      data,
    });

    res.json(updated);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update power entry" });
    return next();
  }
};

export const deleteServerNodePower = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid power entry id" });
      return next();
    }

    const existing = await prisma.serverNodePower.findFirst({
      where: { id, serverNode: { userId: req.user.userId } },
    });

    if (!existing) {
      res.status(404).json({ message: "Power entry not found" });
      return next();
    }

    await prisma.serverNodePower.delete({ where: { id } });
    res.status(204).send();
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete power entry" });
    return next();
  }
};
