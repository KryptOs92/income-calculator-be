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

const currentTemporalInclude = now => ({
  where: {
    effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
  },
  orderBy: { effectiveFrom: "desc" },
  take: 1,
});

const shapeNodeWithCurrentValues = node => {
  const power = node.powerHistory?.[0] ?? null;
  const uptime = node.uptimeHistory?.[0] ?? null;
  // Exclude history arrays from output to keep response compact
  const { powerHistory, uptimeHistory, ...rest } = node;
  return {
    ...rest,
    Wh: power?.Wh ?? null,
    dailyUptimeSeconds: uptime?.dailyUptimeSeconds ?? null,
    currentPowerPeriod: power
      ? { effectiveFrom: power.effectiveFrom, effectiveTo: power.effectiveTo }
      : null,
    currentUptimePeriod: uptime
      ? { effectiveFrom: uptime.effectiveFrom, effectiveTo: uptime.effectiveTo }
      : null,
  };
};

const fetchNodeWithCurrentValues = async (id, userId) => {
  const now = new Date();
  const node = await prisma.serverNode.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      energyRates: true,
      powerHistory: currentTemporalInclude(now),
      uptimeHistory: currentTemporalInclude(now),
    },
  });
  return node ? shapeNodeWithCurrentValues(node) : null;
};

const ensureNodeOwnership = async (serverNodeId, userId) => {
  return prisma.serverNode.findFirst({
    where: { id: serverNodeId, userId, deletedAt: null },
  });
};

const findConflictAt = (modelName, serverNodeId, effectiveFrom) =>
  prisma[modelName].findFirst({
    where: {
      serverNodeId,
      effectiveFrom: { lte: effectiveFrom },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

const hasRangeOverlap = (modelName, serverNodeId, effectiveFrom, effectiveTo) =>
  prisma[modelName].findFirst({
    where: {
      serverNodeId,
      effectiveFrom: { lt: effectiveTo },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
    },
  });

const insertTemporalEntry = async (modelName, serverNodeId, data) => {
  const from = data.effectiveFrom ?? new Date();
  const to = data.effectiveTo === undefined ? null : data.effectiveTo;

  if (to && from >= to) {
    return { error: "effectiveTo must be after effectiveFrom" };
  }

  if (to === null) {
    const conflict = await findConflictAt(modelName, serverNodeId, from);
    if (conflict) {
      if (from <= conflict.effectiveFrom) {
        return {
          error: "effectiveFrom must be after the current open period start",
        };
      }
      await prisma[modelName].update({
        where: { id: conflict.id },
        data: { effectiveTo: minusOneMillisecond(from) },
      });
    }
  } else {
    const overlap = await hasRangeOverlap(modelName, serverNodeId, from, to);
    if (overlap) {
      return { error: "An entry already exists for the provided time range" };
    }
  }

  const created = await prisma[modelName].create({
    data: {
      ...data,
      effectiveFrom: from,
      effectiveTo: to,
      serverNodeId,
    },
  });

  return { created };
};

export const listServerNodes = async (req, res, next) => {
  try {
    const now = new Date();
    const nodes = await prisma.serverNode.findMany({
      where: { userId: req.user.userId, deletedAt: null },
      include: {
        energyRates: true,
        powerHistory: currentTemporalInclude(now),
        uptimeHistory: currentTemporalInclude(now),
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(nodes.map(shapeNodeWithCurrentValues));
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch server nodes" });
    return next();
  }
};

export const getServerNode = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid server node id" });
      return next();
    }

    const node = await fetchNodeWithCurrentValues(id, req.user.userId);

    if (!node) {
      res.status(404).json({ message: "Server node not found" });
      return next();
    }

    res.json(node);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch server node" });
    return next();
  }
};

export const createServerNode = async (req, res, next) => {
  try {
    const {
      name,
      Wh: wh,
      dailyUptimeSeconds,
      powerEffectiveFrom,
      powerEffectiveTo,
      uptimeEffectiveFrom,
      uptimeEffectiveTo,
      energyRateCostPerKwh,
      energyRateCurrency,
      energyRateEffectiveFrom,
      energyRateEffectiveTo,
    } = req.body;

    if (!name) {
      res.status(400).json({ message: "name is required" });
      return next();
    }

    if ((powerEffectiveFrom !== undefined || powerEffectiveTo !== undefined) && wh === undefined) {
      res.status(400).json({ message: "Wh must be provided when power effective dates are set" });
      return next();
    }
    if (
      (uptimeEffectiveFrom !== undefined || uptimeEffectiveTo !== undefined) &&
      dailyUptimeSeconds === undefined
    ) {
      res
        .status(400)
        .json({ message: "dailyUptimeSeconds must be provided when uptime effective dates are set" });
      return next();
    }
    if (
      (energyRateEffectiveFrom !== undefined || energyRateEffectiveTo !== undefined) &&
      energyRateCostPerKwh === undefined
    ) {
      res
        .status(400)
        .json({ message: "energyRateCostPerKwh must be provided when energy rate dates are set" });
      return next();
    }

    const powerData =
      wh !== undefined
        ? (() => {
            const parsedPower = Number(wh);
            if (Number.isNaN(parsedPower)) {
              return { error: "Wh must be a number" };
            }
            const parsedPowerFromInput = parseDate(powerEffectiveFrom);
            const parsedPowerTo = parseDate(powerEffectiveTo);
            if (powerEffectiveFrom !== undefined && !parsedPowerFromInput) {
              return { error: "powerEffectiveFrom is invalid" };
            }
            if (powerEffectiveTo !== undefined && powerEffectiveTo !== null && !parsedPowerTo) {
              return { error: "powerEffectiveTo is invalid" };
            }
            const parsedPowerFrom = parsedPowerFromInput ?? new Date();
            if (parsedPowerTo && parsedPowerFrom >= parsedPowerTo) {
              return { error: "powerEffectiveTo must be after powerEffectiveFrom" };
            }
            return {
              Wh: parsedPower,
              effectiveFrom: parsedPowerFrom,
              effectiveTo: parsedPowerTo ?? null,
            };
          })()
        : null;

    if (powerData?.error) {
      res.status(400).json({ message: powerData.error });
      return next();
    }

    const uptimeData =
      dailyUptimeSeconds !== undefined
        ? (() => {
            const parsedUptime = Number(dailyUptimeSeconds);
            if (Number.isNaN(parsedUptime)) {
              return { error: "dailyUptimeSeconds must be a number" };
            }
            const parsedUptimeFromInput = parseDate(uptimeEffectiveFrom);
            const parsedUptimeTo = parseDate(uptimeEffectiveTo);
            if (uptimeEffectiveFrom !== undefined && !parsedUptimeFromInput) {
              return { error: "uptimeEffectiveFrom is invalid" };
            }
            if (uptimeEffectiveTo !== undefined && uptimeEffectiveTo !== null && !parsedUptimeTo) {
              return { error: "uptimeEffectiveTo is invalid" };
            }
            const parsedUptimeFrom = parsedUptimeFromInput ?? new Date();
            if (parsedUptimeTo && parsedUptimeFrom >= parsedUptimeTo) {
              return { error: "uptimeEffectiveTo must be after uptimeEffectiveFrom" };
            }
            return {
              dailyUptimeSeconds: parsedUptime,
              effectiveFrom: parsedUptimeFrom,
              effectiveTo: parsedUptimeTo ?? null,
            };
          })()
        : null;

    if (uptimeData?.error) {
      res.status(400).json({ message: uptimeData.error });
      return next();
    }

    const energyRateData =
      energyRateCostPerKwh !== undefined
        ? (() => {
            const costValue = energyRateCostPerKwh?.toString?.() ?? "";
            if (!costValue || Number.isNaN(Number(energyRateCostPerKwh))) {
              return { error: "energyRateCostPerKwh must be a valid number" };
            }
            const parsedFromInput = parseDate(energyRateEffectiveFrom);
            const parsedTo = parseDate(energyRateEffectiveTo);
            if (energyRateEffectiveFrom !== undefined && !parsedFromInput) {
              return { error: "energyRateEffectiveFrom is invalid" };
            }
            if (energyRateEffectiveTo !== undefined && energyRateEffectiveTo !== null && !parsedTo) {
              return { error: "energyRateEffectiveTo is invalid" };
            }
            const parsedFrom = parsedFromInput ?? new Date();
            if (parsedTo && parsedFrom >= parsedTo) {
              return { error: "energyRateEffectiveTo must be after energyRateEffectiveFrom" };
            }
            return {
              costPerKwh: costValue,
              currency: energyRateCurrency,
              effectiveFrom: parsedFrom,
              effectiveTo: parsedTo ?? null,
            };
          })()
        : null;

    if (energyRateData?.error) {
      res.status(400).json({ message: energyRateData.error });
      return next();
    }

    const node = await prisma.serverNode.create({
      data: {
        userId: req.user.userId,
        name,
      },
    });

    const operations = [];
    if (powerData) {
      operations.push(insertTemporalEntry("serverNodePower", node.id, powerData));
    }
    if (uptimeData) {
      operations.push(insertTemporalEntry("serverNodeUptime", node.id, uptimeData));
    }
    if (energyRateData) {
      operations.push(
        prisma.energyRate.create({
          data: {
            serverNodeId: node.id,
            costPerKwh: energyRateData.costPerKwh,
            currency: energyRateData.currency,
            effectiveFrom: energyRateData.effectiveFrom,
            effectiveTo: energyRateData.effectiveTo,
          },
        })
      );
    }

    if (operations.length > 0) {
      const results = await Promise.all(operations);
      const firstError = results.find(r => r?.error);
      if (firstError?.error) {
        res.status(409).json({ message: firstError.error });
        return next();
      }
    }

    const shaped = await fetchNodeWithCurrentValues(node.id, req.user.userId);
    res.status(201).json(shaped);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create server node" });
    return next();
  }
};

export const updateServerNode = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid server node id" });
      return next();
    }

    const node = await prisma.serverNode.findFirst({
      where: { id, userId: req.user.userId, deletedAt: null },
    });

    if (!node) {
      res.status(404).json({ message: "Server node not found" });
      return next();
    }

    const {
      name,
      Wh: wh,
      dailyUptimeSeconds,
      powerEffectiveFrom,
      powerEffectiveTo,
      uptimeEffectiveFrom,
      uptimeEffectiveTo,
    } = req.body;

    const operations = [];

    if (name !== undefined) {
      operations.push(
        prisma.serverNode.update({
          where: { id },
          data: { name },
        })
      );
    }

    if (wh !== undefined) {
      const parsedPower = Number(wh);
      if (Number.isNaN(parsedPower)) {
        res.status(400).json({ message: "Wh must be a number" });
        return next();
      }
      const parsedPowerFromInput = parseDate(powerEffectiveFrom);
      const parsedPowerTo = parseDate(powerEffectiveTo);
      if (powerEffectiveFrom !== undefined && !parsedPowerFromInput) {
        res.status(400).json({ message: "powerEffectiveFrom is invalid" });
        return next();
      }
      if (powerEffectiveTo !== undefined && powerEffectiveTo !== null && !parsedPowerTo) {
        res.status(400).json({ message: "powerEffectiveTo is invalid" });
        return next();
      }
      operations.push(
        insertTemporalEntry("serverNodePower", node.id, {
          Wh: parsedPower,
          effectiveFrom: parsedPowerFromInput ?? new Date(),
          effectiveTo: parsedPowerTo ?? null,
        })
      );
    }

    if (dailyUptimeSeconds !== undefined) {
      const parsedUptime = Number(dailyUptimeSeconds);
      if (Number.isNaN(parsedUptime)) {
        res.status(400).json({ message: "dailyUptimeSeconds must be a number" });
        return next();
      }
      const parsedUptimeFromInput = parseDate(uptimeEffectiveFrom);
      const parsedUptimeTo = parseDate(uptimeEffectiveTo);
      if (uptimeEffectiveFrom !== undefined && !parsedUptimeFromInput) {
        res.status(400).json({ message: "uptimeEffectiveFrom is invalid" });
        return next();
      }
      if (uptimeEffectiveTo !== undefined && uptimeEffectiveTo !== null && !parsedUptimeTo) {
        res.status(400).json({ message: "uptimeEffectiveTo is invalid" });
        return next();
      }
      operations.push(
        insertTemporalEntry("serverNodeUptime", node.id, {
          dailyUptimeSeconds: parsedUptime,
          effectiveFrom: parsedUptimeFromInput ?? new Date(),
          effectiveTo: parsedUptimeTo ?? null,
        })
      );
    }

    if (operations.length === 0) {
      res.status(400).json({ message: "Nothing to update" });
      return next();
    }

    if (operations.length === 0) {
      res.status(400).json({ message: "Nothing to update" });
      return next();
    }

    const results = await Promise.all(operations);
    const firstError = results.find(r => r?.error);
    if (firstError?.error) {
      res.status(409).json({ message: firstError.error });
      return next();
    }

    const shaped = await fetchNodeWithCurrentValues(node.id, req.user.userId);
    res.json(shaped);
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update server node" });
    return next();
  }
};

export const deleteServerNode = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ message: "Invalid server node id" });
      return next();
    }

    const node = await prisma.serverNode.findFirst({
      where: { id, userId: req.user.userId, deletedAt: null },
    });

    if (!node) {
      res.status(404).json({ message: "Server node not found" });
      return next();
    }

    await prisma.serverNode.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    res.status(204).send();
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete server node" });
    return next();
  }
};
