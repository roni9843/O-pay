const { Server } = require('socket.io');
const Device = require('./models/Device');
const UserSubscription = require('./models/UserSubscription');
const User = require('./models/User');
const PaymentMethod = require('./models/PaymentMethod');
const PaymentMessage = require('./models/PaymentMessage');
const Setting = require('./models/Setting');
const moment = require('moment-timezone');

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

  function logDeviceSnapshot(reason) {
    const online = [];
    const offline = [];

    for (const device of onlineDevices.values()) {
      if (device.active) {
        online.push(device);
      } else {
        offline.push(device);
      }
    }

    const format = (device) => {
      const meta = deviceMeta.get(String(device.deviceId)) || {};
      const label = meta.deviceUserName || meta.deviceName || device.deviceId;
      const deviceName = meta.deviceName ? ` / ${meta.deviceName}` : '';
      const userName = meta.deviceUserName ? ` / ${meta.deviceUserName}` : '';
      const socketSuffix = device.socketId ? `(${device.socketId})` : '';
      const timeSuffix = device.lastSeen ? ` @ ${device.lastSeen}` : '';
      return `${label}${deviceName}${userName}${socketSuffix}${timeSuffix}`;
    };

    console.log('====================================================');
    console.log(`[device:status] ${reason}`);
    console.log(`[device:status] online: ${online.length}`);
    console.log(`[device:status] offline: ${offline.length}`);
    console.log(`[device:status] online list: ${online.length ? online.map(format).join(' | ') : 'none'}`);
    console.log(`[device:status] offline list: ${offline.length ? offline.map(format).join(' | ') : 'none'}`);
    console.log('====================================================');
  }

  function markActive(deviceId, socketId, telemetry = {}) {
    const now = new Date().toISOString();
    const entry = onlineDevices.get(String(deviceId)) || {};
    onlineDevices.set(String(deviceId), {
      ...entry,
      deviceId: String(deviceId),
      active: true,
      lastSeen: now,
      socketId: socketId || entry.socketId || null,
      ...telemetry
    });
    io.emit('device:status', { deviceId: String(deviceId), active: true, lastSeen: now, ...telemetry });
    broadcastDevices();
    logDeviceSnapshot(`active ${String(deviceId)}`);
    // Notify viewers for this device's owner (filtered stream)
    notifyViewerRooms(String(deviceId), true, now, telemetry).catch(() => {});
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
    logDeviceSnapshot(`inactive ${String(deviceId)}`);
    // Notify viewers for this device's owner (filtered stream)
    notifyViewerRooms(String(deviceId), false, now).catch(() => {});
  }

  function markInactiveIfCurrent(deviceId, socketId) {
    const entry = onlineDevices.get(String(deviceId));
    if (entry && entry.socketId && entry.socketId !== socketId) {
      return;
    }
    markInactive(deviceId);
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

  async function notifyViewerRooms(deviceId, active, lastSeen, telemetry = {}) {
    const meta = await ensureDeviceMeta(deviceId);
    if (!meta || !meta.ownerId) return;
    const payload = {
      deviceId,
      active: Boolean(active),
      lastSeen,
      deviceName: meta.deviceName || null,
      deviceUserName: meta.deviceUserName || null,
      ...telemetry
    };
    io.to(`user:${meta.ownerId}`).emit('viewer:device', payload);
  }

  async function logDeviceEvent(action, deviceId, socketId) {
    const meta = await ensureDeviceMeta(deviceId);
    const label = meta?.deviceUserName || meta?.deviceName || deviceId;
    const deviceName = meta?.deviceName ? ` / ${meta.deviceName}` : '';
    const userName = meta?.deviceUserName ? ` / ${meta.deviceUserName}` : '';
    const socketPart = socketId ? ` socket=${socketId}` : '';
    console.log(`[device:${action}] ${label}${deviceName}${userName}${socketPart}`);
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
      logDeviceEvent('connected', deviceId, socket.id).catch(() => {});
      
      // Handle telemetry during register if provided
      const telemetry = {
        batteryLevel: payload.batteryLevel || null,
        isCharging: payload.isCharging || false,
        networkType: payload.networkType || null,
        networkName: payload.networkName || null
      };

      markActive(deviceId, socket.id, telemetry);
      
      // Send initial live data
      sendLiveInfo(deviceId, socket).catch(console.error);
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
    socket.on('device:heartbeat', async (payload = {}) => {
      if (!currentDeviceId) return;

      // Update live info on every heartbeat
      sendLiveInfo(currentDeviceId, socket).catch(console.error);

      const now = new Date().toISOString();
      const entry = onlineDevices.get(currentDeviceId);
      
      const telemetry = {
        batteryLevel: payload.batteryLevel ?? (entry ? entry.batteryLevel : null),
        isCharging: payload.isCharging ?? (entry ? entry.isCharging : false),
        networkType: payload.networkType ?? (entry ? entry.networkType : null),
        networkName: payload.networkName ?? (entry ? entry.networkName : null)
      };

      if (entry) {
        onlineDevices.set(currentDeviceId, { ...entry, lastSeen: now, ...telemetry });
      } else {
        // If for some reason entry doesn't exist, re-mark as active
        markActive(currentDeviceId, socket.id, telemetry);
      }

      // Broadcast update to all listeners
      io.emit('device:status', { deviceId: currentDeviceId, active: true, lastSeen: now, ...telemetry });
      broadcastDevices();
      
      // Notify owner's rooms
      notifyViewerRooms(currentDeviceId, true, now, telemetry).catch(() => {});
    });

    async function sendLiveInfo(deviceId, targetSocket) {
      try {
        const meta = await ensureDeviceMeta(deviceId);
        if (meta && meta.ownerId) {
          const user = await User.findById(meta.ownerId).lean();
          if (user) {
            // Check for User-specific or Global status message override
            const globalStatus = await Setting.findOne({ key: 'global_status_message' }).lean();
            const isGlobalActive = globalStatus && globalStatus.value && globalStatus.value.active;
            
            if (user.showStatus || isGlobalActive) {
              const title = user.showStatus ? user.statusTitle : globalStatus.value.title;
              const subtitle = user.showStatus ? user.statusSubtitle : globalStatus.value.subtitle;
              const icon = user.showStatus ? user.statusIcon : globalStatus.value.icon;
              
              // Support multi-line cycling for status messages
              const subtitleLines = (subtitle || "").split('\n').map(l => l.trim()).filter(l => l);

              targetSocket.emit('user:live_info', { 
                customTitle: title || "O-PAY PRO",
                customSubtitles: subtitleLines.length > 0 ? subtitleLines : ["Waiting for message..."],
                customIcon: icon || "",
                isStatusMessage: true
              });
              return;
            }

            let infoItems = [];
            infoItems.push(`Credit: ${Math.floor(user.credit)} BDT`);

            if (user.role === 'wallet_agent') {
              const activeMethods = await PaymentMethod.find({ 
                owner: user._id, 
                status: 'active' 
              }).sort({ simIndex: 1 }).lean();

              if (activeMethods.length > 0) {
                activeMethods.forEach(m => {
                  infoItems.push(`S${m.simIndex}: ${m.accountNumber} (${m.provider.toUpperCase()})`);
                });
              } else {
                infoItems.push("No Active SIM");
              }
            } else {
              const startOfDay = moment().tz("Asia/Dhaka").startOf('day').toDate();
              const endOfDay = moment().tz("Asia/Dhaka").endOf('day').toDate();

              const todayTransactions = await PaymentMessage.find({
                deviceId: deviceId,
                createdAt: { $gte: startOfDay, $lte: endOfDay }
              }).select('amount').lean();

              const totalAmount = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
              infoItems.push(`Today Total: ${totalAmount} BDT`);
            }
            targetSocket.emit('user:live_info', { items: infoItems });
          }
        }
      } catch (err) {
        console.error("[sendLiveInfo] error:", err);
      }
    }

    socket.on('disconnect', () => {
      if (currentDeviceId) {
        logDeviceEvent('disconnected', currentDeviceId, socket.id).catch(() => {});
        markInactiveIfCurrent(currentDeviceId, socket.id);
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
