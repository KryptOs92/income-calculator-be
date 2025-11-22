import prisma from "../lib/prisma.js";

const parseId = value => {
  const id = Number(value);
  return Number.isNaN(id) ? null : id;
};

export const listServerNodes = async (req, res, next) => {
  try {
    const nodes = await prisma.serverNode.findMany({
      where: { userId: req.user.userId },
      include: { energyRates: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(nodes);
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

    const node = await prisma.serverNode.findFirst({
      where: { id, userId: req.user.userId },
      include: { energyRates: true },
    });

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
    const { name, Wh: wh, dailyUptimeSeconds } = req.body;
    const parsedPower = Number(wh);
    const parsedUptime = Number(dailyUptimeSeconds);
    if (
      !name ||
      wh === undefined ||
      dailyUptimeSeconds === undefined ||
      Number.isNaN(parsedPower) ||
      Number.isNaN(parsedUptime)
    ) {
      res
        .status(400)
        .json({ message: "name, Wh and dailyUptimeSeconds are required and must be numbers" });
      return next();
    }

    const node = await prisma.serverNode.create({
      data: {
        userId: req.user.userId,
        name,
        Wh: parsedPower,
        dailyUptimeSeconds: parsedUptime,
      },
    });

    res.status(201).json(node);
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
      where: { id, userId: req.user.userId },
    });

    if (!node) {
      res.status(404).json({ message: "Server node not found" });
      return next();
    }

    const { name, Wh: wh, dailyUptimeSeconds } = req.body;
    const parsedPower =
      wh !== undefined ? Number(wh) : node.Wh;
    const parsedUptime =
      dailyUptimeSeconds !== undefined ? Number(dailyUptimeSeconds) : node.dailyUptimeSeconds;

    if (Number.isNaN(parsedPower) || Number.isNaN(parsedUptime)) {
      res.status(400).json({ message: "Wh and dailyUptimeSeconds must be numbers" });
      return next();
    }

    const updated = await prisma.serverNode.update({
      where: { id },
      data: {
        name: name ?? node.name,
        Wh: parsedPower,
        dailyUptimeSeconds: parsedUptime,
      },
    });

    res.json(updated);
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
      where: { id, userId: req.user.userId },
    });

    if (!node) {
      res.status(404).json({ message: "Server node not found" });
      return next();
    }

    await prisma.serverNode.delete({ where: { id } });
    res.status(204).send();
    return next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete server node" });
    return next();
  }
};
