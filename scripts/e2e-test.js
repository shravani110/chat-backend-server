/* End-to-end smoke test: auth → rooms → sockets → file upload.
   Usage: start the server (npm run dev), then: node scripts/e2e-test.js */
const { io } = require("socket.io-client");

const BASE = process.env.BASE_URL || "http://localhost:4000";
const suffix = Date.now().toString(36);

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (e) => reject(new Error("socket auth failed: " + e.message)));
  });
}

async function main() {
  const results = [];
  const ok = (name) => { results.push(`✅ ${name}`); console.log(`✅ ${name}`); };

  // 1. Register two users
  const alice = await api("/api/auth/register", {
    method: "POST",
    body: { email: `alice_${suffix}@test.com`, username: `alice_${suffix}`, password: "password123" },
  });
  const bob = await api("/api/auth/register", {
    method: "POST",
    body: { email: `bob_${suffix}@test.com`, username: `bob_${suffix}`, password: "password123" },
  });
  ok("register: two users created");

  // 2. Login + me
  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email: `alice_${suffix}@test.com`, password: "password123" },
  });
  await api("/api/auth/me", { token: login.accessToken });
  ok("login + /me");

  // 3. Create a DIRECT room
  const room = await api("/api/rooms", {
    method: "POST",
    token: alice.accessToken,
    body: { type: "DIRECT", participantIds: [bob.user.id] },
  });
  ok(`room created (${room.id})`);

  // 4. Sockets: bob listens, alice sends
  const [aliceSock, bobSock] = await Promise.all([
    connectSocket(alice.accessToken),
    connectSocket(bob.accessToken),
  ]);
  ok("both sockets connected + authenticated");

  const received = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("bob never received message:new")), 8000);
    bobSock.on("message:new", (m) => { clearTimeout(t); resolve(m); });
  });
  const ackRes = await new Promise((resolve) =>
    aliceSock.emit("message:send", { roomId: room.id, content: "hello from e2e!" }, resolve)
  );
  if (!ackRes.ok) throw new Error("message:send ack failed: " + ackRes.error);
  const msg = await received;
  if (msg.content !== "hello from e2e!") throw new Error("received wrong message content");
  ok("real-time message delivered alice → bob");

  // 5. History
  const history = await api(`/api/rooms/${room.id}/messages`, { token: bob.accessToken });
  if (!history.messages.some((m) => m.content === "hello from e2e!"))
    throw new Error("message missing from history");
  ok("message history persisted");

  // 6. File upload: presign → PUT → complete → download
  const fileContent = Buffer.from(`e2e test file ${suffix}\n`);
  const presign = await api("/api/files/presign", {
    method: "POST",
    token: alice.accessToken,
    body: { roomId: room.id, fileName: "test.txt", mimeType: "text/plain", fileSize: fileContent.length },
  });
  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/plain", "Content-Length": String(fileContent.length) },
    body: fileContent,
  });
  if (!putRes.ok) throw new Error(`storage PUT failed: ${putRes.status} ${await putRes.text()}`);
  ok("file uploaded to storage via presigned URL");

  const fileMsgPromise = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("bob never received file message")), 8000);
    bobSock.on("message:new", (m) => { if (m.type === "FILE") { clearTimeout(t); resolve(m); } });
  });
  const fileMsg = await api("/api/files/complete", {
    method: "POST",
    token: alice.accessToken,
    body: { roomId: room.id, key: presign.key, caption: "here's a file" },
  });
  await fileMsgPromise;
  ok("file message created + broadcast to bob");

  const dl = await api(`/api/files/${fileMsg.id}/download`, { token: bob.accessToken });
  const dlRes = await fetch(dl.downloadUrl);
  const dlText = await dlRes.text();
  if (dlText !== fileContent.toString()) throw new Error("downloaded content mismatch");
  ok("file downloaded via presigned URL, content matches");

  // 7. Presence: disconnect bob, alice should see presence:offline
  const offline = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("presence:offline not received")), 8000);
    aliceSock.on("presence:offline", (d) => { if (d.userId === bob.user.id) { clearTimeout(t); resolve(d); } });
  });
  bobSock.disconnect();
  await offline;
  ok("presence: offline event fired on disconnect");

  aliceSock.disconnect();
  console.log(`\n🎉 ALL ${results.length} CHECKS PASSED`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ E2E FAILED:", err.message);
  process.exit(1);
});
