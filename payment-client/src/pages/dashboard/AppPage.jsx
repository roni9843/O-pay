import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "https://api.oraclepay.org";
const TARGET_APP_ID = import.meta.env.VITE_APP_PRESENCE_ID || "localhost:3000";
const TARGET_DEVICE_CODE = import.meta.env.VITE_TARGET_DEVICE_CODE || "";

export default function AppPage() {
  const [count, setCount] = useState(0);
  const [allApps, setAllApps] = useState([]);
  const [devices, setDevices] = useState([]);
  const socketRef = useRef(null);

  const onlineDevices = useMemo(() => devices.filter((d) => d.active), [devices]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      // Register this tab under the target appId (so opening multiple App pages increments count)
      socket.emit("app:register", { appId: TARGET_APP_ID });
      // Ask for current snapshot
      socket.emit("app:list");
      socket.emit("devices:list");
    });

    socket.on("app:update", ({ appId, count }) => {
      if (appId === TARGET_APP_ID) {
        setCount(count || 0);
      }
    });

    socket.on("apps:update", (apps) => {
      setAllApps(apps || []);
      const current = (apps || []).find((a) => a.appId === TARGET_APP_ID);
      setCount(current ? current.count : 0);
    });

    socket.on("devices:update", (list) => {
      setDevices(Array.isArray(list) ? list : []);
    });

    socket.on("device:status", (entry) => {
      if (!entry || !entry.deviceId) return;
      setDevices((prev) => {
        const map = new Map(prev.map((d) => [d.deviceId, d]));
        map.set(entry.deviceId, { ...(map.get(entry.deviceId) || { deviceId: entry.deviceId }), ...entry });
        return Array.from(map.values());
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">App Presence</h2>
        <p className="text-sm text-gray-500">
          Real-time online tab counter via Socket.IO for <span className="font-mono">{TARGET_APP_ID}</span>
        </p>
      </div>

      <div className="rounded-lg border p-6 bg-white dark:bg-gray-900">
        <div className="text-3xl font-bold">{count}</div>
        <div className="text-gray-500">Online tabs for {TARGET_APP_ID}</div>
      </div>

      <div className="rounded-lg border p-6 bg-white dark:bg-gray-900 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">Devices Presence</div>
            <div className="text-sm text-gray-500">Real-time device online/offline with device code</div>
          </div>
          <div className="text-sm text-gray-600">
            Online: <span className="font-medium">{onlineDevices.length}</span> / Total: <span className="font-medium">{devices.length}</span>
          </div>
        </div>

        {TARGET_DEVICE_CODE ? (
          <div className="text-sm">
            Target device: <span className="font-mono">{TARGET_DEVICE_CODE}</span>
          </div>
        ) : null}

        {onlineDevices.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-1">Online device codes</div>
            <div className="flex flex-wrap gap-2">
              {onlineDevices.map((d) => (
                <span key={`online-${d.deviceId}`} className="px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-mono">
                  {d.deviceId}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="divide-y">
          {devices.length === 0 ? (
            <div className="text-gray-500 text-sm">No devices connected</div>
          ) : (
            devices
              .slice()
              .sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1))
              .map((d) => (
                <div key={d.deviceId} className="py-2 flex items-center justify-between">
                  <div>
                    <div className={`font-mono ${TARGET_DEVICE_CODE && d.deviceId === TARGET_DEVICE_CODE ? 'text-indigo-600 font-semibold' : ''}`}>
                      {d.deviceId}
                    </div>
                    <div className="text-xs text-gray-500">lastSeen: {d.lastSeen || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${d.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {d.active ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="font-medium mb-2">All Apps (debug)</div>
        <div className="space-y-1 text-sm">
          {allApps.length === 0 ? (
            <div className="text-gray-500">No active apps</div>
          ) : (
            allApps.map((a) => (
              <div key={a.appId} className="flex items-center justify-between">
                <span className="font-mono">{a.appId}</span>
                <span className="text-gray-600">{a.count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-800">
        <div className="font-semibold mb-2">How to count tabs on your site</div>
        <ol className="list-decimal pl-6 space-y-1 text-sm">
          <li>Add the following snippet to the site you want to track (e.g. http://localhost:3000):</li>
        </ol>
        <pre className="mt-3 text-xs overflow-auto p-3 bg-black text-green-200 rounded">
{`<script src="https://cdn.socket.io/4.7.5/socket.io.min.js" crossorigin="anonymous"></script>
<script>
  const socket = io("${SOCKET_URL}", { transports: ["websocket"] });
  socket.on("connect", () => {
    socket.emit("app:register", { appId: "${TARGET_APP_ID}" });
  });
  window.addEventListener("beforeunload", () => {
    try { socket.disconnect(); } catch(e){}
  });
</script>`}
        </pre>
        <p className="text-xs text-gray-500 mt-2">Each open tab creates one Socket.IO connection and is counted separately.</p>
      </div>
    </div>
  );
}
