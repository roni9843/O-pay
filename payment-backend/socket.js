const { Server } = require('socket.io');
const Device = require('./models/Device');
const UserSubscription = require('./models/UserSubscription');

module.exports = function initSocket(server, app) {
  // In-memory device presence map
  // deviceId -> { deviceId, active, lastSeen: ISO string, socketId }
  const onlineDevices = new Map();

  // Cache: deviceId -> { ownerId, deviceName, deviceUserName }
  const deviceMeta = new Map();

  // In-memory app presence (counts tabs/connections per appId)
  // appId -> { appId, count, sockets: Set<socketId> }
  const appPresence = new Map();

  // Configure Socket.IO with permissive CORS by default (customize via env if needed)
  const io = new Server(server, {
    cors: {
      origin: process.env.SOCKET_IO_ORIGINS ? process.env.SOCKET_IO_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST']
    }
  });

  // Expose io and presence maps to routes if they need to emit events or read status
  if (app && typeof app.set === 'function') {
    app.set('io', io);
    app.set('onlineDevices', onlineDevices);
    app.set('appPresence', appPresence);
  }

  function broadcastDevices() {
    io.emit('devices:update', Array.from(onlineDevices.values()));
  }

  function markActive(deviceId, socketId) {
    const now = new Date().toISOString();
    onlineDevices.set(String(deviceId), {
      deviceId: String(deviceId),
      active: true,
      lastSeen: now,
      socketId: socketId || null,
    });
    io.emit('device:status', { deviceId: String(deviceId), active: true, lastSeen: now });
    broadcastDevices();
    // Notify viewers for this device's owner (filtered stream)
    notifyViewerRooms(String(deviceId), true, now).catch(() => {});
  }

  function markInactive(deviceId) {
    const prev = onlineDevices.get(String(deviceId));
    const now = new Date().toISOString();
    if (prev) {
      onlineDevices.set(String(deviceId), { ...prev, active: false, lastSeen: now, socketId: null });
    } else {
      onlineDevices.set(String(deviceId), { deviceId: String(deviceId), active: false, lastSeen: now, socketId: null });
    }
    io.emit('device:status', { deviceId: String(deviceId), active: false, lastSeen: now });
    broadcastDevices();
    // Notify viewers for this device's owner (filtered stream)
    notifyViewerRooms(String(deviceId), false, now).catch(() => {});
  }

  async function ensureDeviceMeta(deviceId) {
    const key = String(deviceId);
    if (deviceMeta.has(key) && deviceMeta.get(key)?.ownerId) return deviceMeta.get(key);
    const doc = await Device.findOne({ deviceCode: key }).select('owner deviceName deviceUserName').lean();
    if (doc) {
      const meta = { ownerId: String(doc.owner), deviceName: doc.deviceName || null, deviceUserName: doc.deviceUserName || null };
      deviceMeta.set(key, meta);
      return meta;
    }
    return null;
  }

  async function notifyViewerRooms(deviceId, active, lastSeen) {
    const meta = await ensureDeviceMeta(deviceId);
    if (!meta || !meta.ownerId) return;
    const payload = {
      deviceId,
      active: Boolean(active),
      lastSeen,
      deviceName: meta.deviceName || null,
      deviceUserName: meta.deviceUserName || null,
    };
    io.to(`user:${meta.ownerId}`).emit('viewer:device', payload);
  }

  io.on('connection', (socket) => {
    let currentDeviceId = null;
    // Track which appIds this socket registered to (for cleanup)
    socket.data.appIds = new Set();
    // Track viewer registration (by user)
    socket.data.viewerUserId = null;

    // Client asks for current list
    socket.on('devices:list', () => {
      socket.emit('devices:update', Array.from(onlineDevices.values()));
    });

    // Device registers itself
    socket.on('device:register', (payload) => {
      const deviceId = payload && payload.deviceId ? String(payload.deviceId) : null;
      if (!deviceId) {
        console.log(`[device:register] Ignoring register request from socket ${socket.id} due to missing deviceId`);
        return;
      }
      currentDeviceId = deviceId;
      console.log(`[device:register] deviceId=${deviceId} socket=${socket.id}`);
      markActive(deviceId, socket.id);
    });

    // App presence: register a tab/connection under an appId
    socket.on('app:register', (payload) => {
      const appId = payload && payload.appId ? String(payload.appId) : null;
      if (!appId) return;
      if (!appPresence.has(appId)) {
        appPresence.set(appId, { appId, count: 0, sockets: new Set() });
      }
      const entry = appPresence.get(appId);
      if (!entry.sockets.has(socket.id)) {
        entry.sockets.add(socket.id);
        entry.count = entry.sockets.size;
        socket.data.appIds.add(appId);
        // Log to backend console
        console.log(`[app:register] appId=${appId} socket=${socket.id} count=${entry.count}`);
        // Broadcast updated count
        io.emit('app:update', { appId, count: entry.count });
        io.emit('apps:update', Array.from(appPresence.values()).map(({ appId, count }) => ({ appId, count })));
      }
    });

    // App presence: client requests current stats
    socket.on('app:list', () => {
      socket.emit('apps:update', Array.from(appPresence.values()).map(({ appId, count }) => ({ appId, count })));
    });

    // Viewer registers with API key to watch only their user's devices
    socket.on('viewer:registerApiKey', async (payload = {}) => {
      try {
        const apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';
        if (!apiKey) {
          socket.emit('viewer:error', { message: 'Missing apiKey' });
          return;
        }
        const sub = await UserSubscription.findOne({ apiKey }).select('user endDate active apiKeyActive').lean();
        if (!sub) {
          socket.emit('viewer:error', { message: 'Invalid apiKey' });
          return;
        }
        if (!sub.apiKeyActive || !sub.active || new Date(sub.endDate) <= new Date()) {
          socket.emit('viewer:error', { message: 'Subscription inactive or expired' });
          return;
        }
        const userId = String(sub.user);
        socket.data.viewerUserId = userId;
        // Join a room per user so we can push filtered updates
        await socket.join(`user:${userId}`);
        // Load user's devices
        const devices = await Device.find({ owner: userId }).select('deviceCode deviceName deviceUserName').lean();
        const snapshot = devices.map((d) => {
          const id = String(d.deviceCode || '');
          if (id) {
            deviceMeta.set(id, { ownerId: userId, deviceName: d.deviceName || null, deviceUserName: d.deviceUserName || null });
          }
          const live = id ? onlineDevices.get(id) : null;
          return {
            deviceId: id || null,
            deviceName: d.deviceName || null,
            deviceUserName: d.deviceUserName || null,
            active: Boolean(live?.active),
            lastSeen: live?.lastSeen || null,
          };
        });
        socket.emit('viewer:devices', snapshot);
      } catch (e) {
        console.error('[viewer:registerApiKey] error', e);
        socket.emit('viewer:error', { message: e?.message || 'Server error' });
      }
    });

    // Heartbeat from device
    socket.on('device:heartbeat', () => {
      if (!currentDeviceId) return;
      const now = new Date().toISOString();
      const entry = onlineDevices.get(currentDeviceId);
      if (entry) {
        onlineDevices.set(currentDeviceId, { ...entry, lastSeen: now });
      }
    });

    socket.on('disconnect', () => {
      if (currentDeviceId) {
        markInactive(currentDeviceId);
      }
      // Cleanup app presence registrations for this socket
      if (socket.data && socket.data.appIds && socket.data.appIds.size) {
        console.log(`[disconnect] currentDeviceId=${currentDeviceId}`);
        for (const appId of socket.data.appIds) {
          const entry = appPresence.get(appId);
          if (entry) {
        console.log(`[disconnect] clearing app presence registrations for socket=${socket.id}`);
            entry.sockets.delete(socket.id);
            entry.count = entry.sockets.size;
            console.log(`[app:disconnect] appId=${appId} socket=${socket.id} count=${entry.count}`);
            // Broadcast updated count
            io.emit('app:update', { appId, count: entry.count });
            io.emit('apps:update', Array.from(appPresence.values()).map(({ appId, count }) => ({ appId, count })));
            if (entry.count === 0) {
              appPresence.delete(appId);
            }
          }
        }
        // Leave viewer room
        if (socket.data.viewerUserId) {
          socket.leave(`user:${socket.data.viewerUserId}`).catch(() => {});
        }
      }
    });
  });

  // Sweep to auto-mark devices inactive if no heartbeat for a while (e.g., 30s)
  setInterval(() => {
    const now = Date.now();
    const TIMEOUT_MS = 30 * 1000;
    for (const [id, entry] of onlineDevices.entries()) {
      const last = entry.lastSeen ? Date.parse(entry.lastSeen) : 0;
      if (entry.active && last && now - last > TIMEOUT_MS) {
        markInactive(id);
      }
    }
  }, 10 * 1000);

  return { io, onlineDevices, appPresence };
}
