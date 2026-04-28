# ডিভাইস অনলাইন/অফলাইন (API Key + Socket)

উদ্দেশ্য: শুধুমাত্র একটি API key দিয়ে ইউজারের সব ডিভাইস অনলাইন/অফলাইন স্ট্যাটাস জানুন।

মূল কথা
- টেক: Socket.IO (রিয়েলটাইম)
- ইভেন্ট (Client → Server): `viewer:registerApiKey` `{ apiKey }`
- রেসপন্স (Server → Client):
  - `viewer:devices` — সব ডিভাইসের বর্তমান স্ট্যাটাস (স্ন্যাপশট)
  - `viewer:device` — একক ডিভাইসের আপডেট (online/offline + lastSeen)
  - `viewer:error` — key invalid/expired/inactive হলে

কন্ডিশন
- API key বৈধ, `apiKeyActive: true`
- সাবস্ক্রিপশন `active: true` এবং `endDate` ভবিষ্যতে

কুইক এক্সাম্পল (Vanilla JS)
```html
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<script>
  const socket = io("https://api.oraclepay.org", { transports: ["websocket"] });

  socket.on("connect", () => {
    socket.emit("viewer:registerApiKey", { apiKey: "YOUR_API_KEY" });
  });

  socket.on("viewer:devices", (list) => {
    console.log("snapshot", list);
    // list: [{ deviceId, deviceName, deviceUserName, active, lastSeen }]
  });

  socket.on("viewer:device", (d) => {
    console.log("update", d);
    // d: { deviceId, active, lastSeen, deviceName?, deviceUserName? }
  });

  socket.on("viewer:error", (e) => console.error(e));
</script>
```

React (সংক্ষিপ্ত)
```js
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function Presence({ apiKey }) {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    const s = io("https://api.oraclepay.org", { transports: ["websocket"] });

    s.on("connect", () => s.emit("viewer:registerApiKey", { apiKey }));
    s.on("viewer:devices", (list) => setDevices(list));
    s.on("viewer:device", (d) => setDevices((p) => {
      const i = p.findIndex(x => x.deviceId === d.deviceId);
      if (i < 0) return [...p, d];
      const c = p.slice(); c[i] = { ...c[i], ...d }; return c;
    }));
    s.on("viewer:error", (e) => console.error(e));

    return () => s.close();
  }, [apiKey]);

  return (
    <ul>
      {devices.map(d => (
        <li key={d.deviceId}>
          {(d.deviceUserName || d.deviceName || d.deviceId)} — {d.active ? "Online" : "Offline"}
          {d.lastSeen && ` (last: ${new Date(d.lastSeen).toLocaleString()})`}
        </li>
      ))}
    </ul>
  );
}
```

টিপস
- হার্টবিট না এলে ~30 সেকেন্ড পর ডিভাইস auto-offline হয়
- যদি কিছুই না আসে: API key, সাবস্ক্রিপশন স্ট্যাটাস, এবং ডিভাইস `deviceCode` ঠিক আছে কিনা দেখুন
