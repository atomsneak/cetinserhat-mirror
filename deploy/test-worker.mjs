// Worker mantığını yerelde sınamak için harness (Workers runtime değil, Node fetch).
// Amaç: (a) origin canlıyken pass-through, (b) origin ölüyken ayna fallback,
// (c) POST'ta fallback YOK, (d) /api ve /admin fallback YOK.
import worker from "../deploy/worker.js";

const realFetch = globalThis.fetch;
let mode = "origin-up";

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (mode === "origin-down" && url.includes("www.cetinserhat.com")) {
    throw new Error("simulated: origin unreachable (tunnel down)");
  }
  return realFetch(input, init);
};

async function call(path, method = "GET") {
  const req = new Request("https://cetinserhat.com" + path, { method });
  const t0 = Date.now();
  const res = await worker.fetch(req, {}, {});
  const body = await res.text();
  return {
    status: res.status,
    mirror: res.headers.get("x-cetinserhat-mirror"),
    cc: res.headers.get("cache-control"),
    bytes: body.length,
    ms: Date.now() - t0,
    head: body.slice(0, 60).replace(/\s+/g, " "),
  };
}

const cases = [
  ["/", "GET"],
  ["/blog/", "GET"],
  ["/blog/noktasiz-bir-harf-dunyanin-yazilimini-nasil-kirdi", "GET"],
  ["/assets/logo.png", "GET"],
  ["/api/posts", "GET"],
  ["/admin", "GET"],
  ["/api/contact", "POST"],
];

for (const m of ["origin-up", "origin-down"]) {
  mode = m;
  console.log(`\n=== ${m} ===`);
  for (const [p, meth] of cases) {
    try {
      const r = await call(p, meth);
      console.log(
        `${meth.padEnd(4)} ${p.slice(0, 46).padEnd(48)} ${String(r.status).padEnd(4)} ` +
          `mirror=${String(r.mirror).padEnd(5)} ${String(r.bytes).padStart(6)}b ${String(r.ms).padStart(5)}ms  ${r.head}`
      );
    } catch (e) {
      console.log(`${meth.padEnd(4)} ${p.slice(0, 46).padEnd(48)} HATA: ${e.message}`);
    }
  }
}
