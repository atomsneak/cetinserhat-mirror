/**
 * cetinserhat.com — origin failover Worker
 *
 * Amaç: Pimini / Cloudflare Tünel erişilemez olduğunda (ör. ev interneti
 * kesintisi, Cloudflare 530 / error 1033) ziyaretçiye 530 yerine GitHub
 * Pages'teki son statik kopyayı göstermek.
 *
 * Tasarım kuralları (bozmayın):
 *  1. NORMAL trafikte HİÇBİR ŞEY değişmez — origin ne döndürürse o geçer.
 *  2. Hata olursa bugünkü davranışa (530) düşer; Worker asla yeni bir hata
 *     kaynağı olmaz.
 *  3. Origin adresi www.cetinserhat.com'dur. Bu hostname Worker route'una
 *     DAHİL DEĞİL (yoksa sonsuz döngü olur) ve uygulamanın kanonik host
 *     beyaz listesindedir → 200 döner, 301 yapmaz. Byte-eşitliği ölçüldü.
 *  4. /admin ve /api/* fallback'e düşmez; ayna kopyasında da yoktur.
 *  5. Fallback yanıtları no-store ile döner: origin geri gelince bayat
 *     içerik yapışıp kalmaz.
 *
 * Route: cetinserhat.com/*   (www route'a EKLENMEZ)
 */

const ORIGIN_HOST = "www.cetinserhat.com";
const MIRROR_HOSTS = ["https://mirror.cetinserhat.com", "http://mirror.cetinserhat.com"];
const ORIGIN_TIMEOUT_MS = 4000;
const MIRROR_TIMEOUT_MS = 6000;

// Aynadan servis EDİLMEYECEK yollar: canlı veri / panel. Statik varlıklar
// (/assets, /uploads) fallback'e DAHİLDİR — yoksa yedek sayfa stilsiz açılır.
const NEVER_FALLBACK = [/^\/api\//i, /^\/admin/i];

const PAGE_503 = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Geçici olarak ulaşılamıyor</title>
<style>
:root{color-scheme:dark}
body{background:#090b0e;color:#f8fafc;font-family:Poppins,system-ui,sans-serif;margin:0;
display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
h1{font-size:2rem;margin:0 0 .75rem}p{color:#94a3b8;line-height:1.6;max-width:30rem}
a{color:#38bdf8;text-decoration:none}
</style></head><body><div>
<h1>Şu an ulaşılamıyor</h1>
<p>Site kaynağına erişilemiyor. Birkaç dakika içinde tekrar deneyin.</p>
<p><a href="/">Yeniden dene</a></p>
</div></body></html>`;

function unavailable(extra = {}) {
  return new Response(PAGE_503, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "retry-after": "120",
      ...extra,
    },
  });
}

async function tryOrigin(request, url) {
  const target = new URL(request.url);
  target.hostname = ORIGIN_HOST;
  target.protocol = "https:";

  const init = {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
    signal: AbortSignal.timeout(ORIGIN_TIMEOUT_MS),
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.clone().body;
  }

  const res = await fetch(new Request(target.toString(), init));
  // 530 = tünel yok (error 1033). 5xx dışındaki her şey gerçek yanıttır.
  if (res.status >= 500) {
    throw new Error("origin status " + res.status);
  }
  return res;
}

async function tryMirror(request, url) {
  // GitHub Pages dizin URL'lerini /blog/<slug> -> /blog/<slug>/ olarak 301'ler;
  // bu yüzden redirect takip EDİLİR (ayna zaten kendi alan adımız).
  // Sondaki eğik çizgi yoksa bir de öyle denenir.
  const candidates = [url.pathname + url.search];
  if (!/\.[a-z0-9]{1,6}$/i.test(url.pathname) && !url.pathname.endsWith("/")) {
    candidates.push(url.pathname + "/" + url.search);
  }

  let lastErr = null;
  for (const base of MIRROR_HOSTS) {
    for (const cand of candidates) {
      try {
        const res = await fetch(base + cand, {
          method: request.method === "HEAD" ? "HEAD" : "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
          headers: { "user-agent": "cetinserhat-mirror-fallback/1.0" },
        });
        if (res.status === 200) {
          const h = new Headers(res.headers);
          h.set("cache-control", "no-store, max-age=0");
          h.set("x-cetinserhat-mirror", "hit");
          h.delete("content-security-policy");
          return new Response(res.body, { status: 200, headers: h });
        }
        lastErr = new Error("mirror status " + res.status + " " + cand);
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr || new Error("mirror unreachable");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const isRead = request.method === "GET" || request.method === "HEAD";

    let originRes = null;
    try {
      originRes = await tryOrigin(request, url);
      return originRes;
    } catch (err) {
      // origin erişilemez → aşağıda ayna denenir
    }

    // Yazma işlemleri (form, admin) aynadan servis EDİLMEZ
    if (!isRead) {
      return new Response(
        JSON.stringify({ error: "Site kaynağına şu an ulaşılamıyor, işlem kaydedilmedi." }),
        { status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
      );
    }

    if (NEVER_FALLBACK.some((rx) => rx.test(path))) {
      return new Response(JSON.stringify({ error: "kaynak ulaşılamıyor" }), {
        status: 503,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    try {
      return await tryMirror(request, url);
    } catch (e) {
      return unavailable({ "x-cetinserhat-fallback": "failed" });
    }
  },
};
