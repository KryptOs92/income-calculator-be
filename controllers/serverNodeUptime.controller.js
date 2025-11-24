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
  return prisma.serverNode.findFirst({
    where: { id: serverNodeId, userId, deletedAt: null },
  });
};

const findConflictAt = (serverNodeId, effectiveFrom, excludeId) =>
  prisma.serverNodeUptime.findFirst({
    where: {
      serverNodeId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      effectiveFrom: { lte: effectiveFrom },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

const hasRangeOverlap = (serverNodeId, effectiveFrom, effectiveTo, excludeId) =>
  prisma.serverNodeUptime.findFirst({
    where: {
      serverNodeId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      effectiveFrom: { lt: effectiveTo },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
    },
  });

export const listServerNodeUptimes = async (req, res, next) => {
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

    const entries = await prisma.serverNodeUptime.findMany({
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

    res.json(entries);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch server node uptime history" });
    return next();
  }
};

export const getServerNodeUptime = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid uptime entry id" });
      return next();
    }

    const entry = await prisma.serverNodeUptime.findFirst({
      where: { id, serverNode: { userId: req.user.userId, deletedAt: null } },
    });

    if (!entry) {
      res.status(404).json({ message: "Uptime entry not found" });
      return next();
    }

    res.json(entry);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch uptime entry" });
    return next();
  }
};

export const createServerNodeUptime = async (req, res, next) => {
  try {
    const { serverNodeId, dailyUptimeSeconds, effectiveFrom, effectiveTo } = req.body;
    const parsedNodeId = parseId(serverNodeId);
    const parsedUptime = Number(dailyUptimeSeconds);
    if (parsedNodeId === null || Number.isNaN(parsedUptime)) {
      res
        .status(400)
        .json({ message: "serverNodeId and dailyUptimeSeconds are required and must be valid" });
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
        await prisma.serverNodeUptime.update({
          where: { id: conflict.id },
          data: { effectiveTo: minusOneDay(from) },
        });
      }
    } else {
      const overlap = await hasRangeOverlap(parsedNodeId, from, to);
      if (overlap) {
        res.status(409).json({ message: "An uptime entry already exists for the provided time range" });
        return next();
      }
    }

    const created = await prisma.serverNodeUptime.create({
      data: {
        serverNodeId: parsedNodeId,
        dailyUptimeSeconds: parsedUptime,
        effectiveFrom: from,
        effectiveTo: to,
      },
    });

    res.status(201).json(created);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create uptime entry" });
    return next();
  }
};

export const updateServerNodeUptime = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid uptime entry id" });
      return next();
    }

    const existing = await prisma.serverNodeUptime.findFirst({
      where: { id, serverNode: { userId: req.user.userId, deletedAt: null } },
    });

    if (!existing) {
      res.status(404).json({ message: "Uptime entry not found" });
      return next();
    }

    const { dailyUptimeSeconds, effectiveFrom, effectiveTo } = req.body;
    const data = {};

    if (dailyUptimeSeconds !== undefined) {
      const parsedUptime = Number(dailyUptimeSeconds);
      if (Number.isNaN(parsedUptime)) {
        res.status(400).json({ message: "dailyUptimeSeconds must be a number" });
        return next();
      }
      data.dailyUptimeSeconds = parsedUptime;
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
        await prisma.serverNodeUptime.update({
          where: { id: conflict.id },
          data: { effectiveTo: minusOneDay(from) },
        });
      }
    } else {
      const overlap = await hasRangeOverlap(existing.serverNodeId, from, to, existing.id);
      if (overlap) {
        res
          .status(409)
          .json({ message: "An uptime entry already exists for the provided time range" });
        return next();
      }
    }

    const updated = await prisma.serverNodeUptime.update({
      where: { id },
      data,
    });

    res.json(updated);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update uptime entry" });
    return next();
  }
};

export const deleteServerNodeUptime = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid uptime entry id" });
      return next();
    }

    const existing = await prisma.serverNodeUptime.findFirst({
      where: { id, serverNode: { userId: req.user.userId, deletedAt: null } },
    });

    if (!existing) {
      res.status(404).json({ message: "Uptime entry not found" });
      return next();
    }

    await prisma.serverNodeUptime.delete({ where: { id } });
    res.status(204).send();
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete uptime entry" });
    return next();
  }
};
