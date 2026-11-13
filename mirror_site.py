#!/usr/bin/env python3
"""cetinserhat.com statik ayna üretici.

BEYAZ LİSTE mantığı: yalnızca sitemap.xml'deki URL'ler + HTML'de geçen
/assets/ ve /uploads/ dosyaları indirilir. /admin, /api, /.env, /data ASLA istenmez.

Kullanım:
  mirror_site.py build   # aynayı üret (varsayılan)
  mirror_site.py scan    # sadece sır taraması
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://cetinserhat.com"
REPO = os.path.expanduser("~/projects/cetinserhat-mirror")
SITE = os.path.join(REPO, "docs")
ALLOW_PREFIX = ("/assets/", "/uploads/")
UA = {"User-Agent": "cetinserhat-mirror/1.0 (+statik yedek)"}
TIMEOUT = 20

# Push'u durduran desenler (büyük/küçük harf duyarsız)
SECRET_PATTERNS = [
    r"AIza[0-9A-Za-z_\-]{35}",
    r"sk-[A-Za-z0-9]{20,}",
    r"ghp_[A-Za-z0-9]{20,}",
    r"gho_[A-Za-z0-9]{20,}",
    r"xox[baprs]-[A-Za-z0-9\-]{10,}",
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    r"client_secret[\"']?\s*[:=]\s*[\"'][^\"']{8,}",
    r"api[_-]?key[\"']?\s*[:=]\s*[\"'][^\"']{12,}",
    r"SMTP_PASS[\"']?\s*[:=]",
    r"ADMIN_SECRET_KEY[\"']?\s*[:=]",
    r"ADMIN_PASSWORD[\"']?\s*[:=]",
    r"\bBearer\s+[A-Za-z0-9._\-]{20,}",
]


def fetch(path_or_url, binary=False):
    url = path_or_url if path_or_url.startswith("http") else BASE + path_or_url
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        if r.status != 200:
            raise urllib.error.HTTPError(url, r.status, "non-200", r.headers, None)
        return r.read() if binary else r.read().decode("utf-8", "replace")


def url_to_file(u):
    p = urllib.parse.urlparse(u).path
    if p in ("", "/"):
        return os.path.join(SITE, "index.html")
    rel = p.lstrip("/")
    if p.endswith("/") or "." not in rel.rsplit("/", 1)[-1]:
        rel = rel.rstrip("/") + "/index.html"
    return os.path.join(SITE, rel)


def asset_refs(html):
    """HTML içinden izinli varlık yollarını çıkar."""
    out = set()
    for m in re.finditer(r"""(?:href|src|content|poster)=["']([^"']+)["']""", html, re.I):
        v = m.group(1).strip()
        if v.startswith("/") and v.startswith(ALLOW_PREFIX):
            out.add(urllib.parse.urlparse(v).path)
    # srcset / inline css url(...)
    for m in re.finditer(r"""url\(["']?(/[^"')]+)["']?\)""", html):
        v = m.group(1)
        if v.startswith(ALLOW_PREFIX):
            out.add(urllib.parse.urlparse(v).path)
    for m in re.finditer(r"""srcset=["']([^"']+)["']""", html, re.I):
        for part in m.group(1).split(","):
            v = part.strip().split(" ")[0]
            if v.startswith("/") and v.startswith(ALLOW_PREFIX):
                out.add(urllib.parse.urlparse(v).path)
    return out


def build():
    if os.path.isdir(SITE):
        shutil.rmtree(SITE)
    os.makedirs(SITE, exist_ok=True)

    sm = fetch("/sitemap.xml")
    urls = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", sm)
    if not urls:
        sys.exit("HATA: sitemap boş — dur.")

    assets, pages, failures = set(), [], []
    for u in urls:
        try:
            html = fetch(u)
        except Exception as e:
            failures.append((u, str(e)))
            continue
        dest = url_to_file(u)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            f.write(html)
        pages.append((u, len(html), os.path.relpath(dest, SITE)))
        assets |= asset_refs(html)

    # varlıkları indir
    got_assets = 0
    for a in sorted(assets):
        dest = os.path.join(SITE, a.lstrip("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        try:
            data = fetch(a, binary=True)
            with open(dest, "wb") as f:
                f.write(data)
            got_assets += 1
        except Exception as e:
            failures.append((a, str(e)))

    # CSS içindeki göreli url() referanslarını da çek (tek seviye)
    extra = 0
    for root, _, files in os.walk(SITE):
        for fn in files:
            if not fn.endswith(".css"):
                continue
            p = os.path.join(root, fn)
            css = open(p, encoding="utf-8", errors="replace").read()
            for m in re.finditer(r"""url\(["']?(?!data:|https?:|//)([^"')]+)["']?\)""", css):
                ref = m.group(1)
                target = os.path.normpath(os.path.join(os.path.dirname(p), ref))
                if not target.startswith(SITE) or os.path.exists(target):
                    continue
                relurl = "/" + os.path.relpath(target, SITE).replace(os.sep, "/")
                if not relurl.startswith(ALLOW_PREFIX):
                    continue
                try:
                    data = fetch(relurl, binary=True)
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    open(target, "wb").write(data)
                    extra += 1
                except Exception:
                    pass

    # GitHub Pages / SEO dosyaları
    open(os.path.join(SITE, ".nojekyll"), "w").close()
    open(os.path.join(SITE, "robots.txt"), "w").write(
        "# Yedek ayna — arama motorlarına kapalı\nUser-agent: *\nDisallow: /\n"
    )
    open(os.path.join(SITE, "CNAME"), "w").write("mirror.cetinserhat.com\n")
    open(os.path.join(SITE, "404.html"), "w", encoding="utf-8").write(
        """<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="robots" content="noindex"><title>Sayfa bulunamadı — cetinserhat.com</title>
<style>body{background:#090b0e;color:#f8fafc;font-family:Poppins,system-ui,sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
a{color:#38bdf8;text-decoration:none}p{color:#94a3b8;max-width:32rem;line-height:1.6}</style></head>
<body><div><h1 style="font-size:4rem;margin:0">404</h1>
<p>Bu adres yedek kopyada yok.<br><a href="/">Ana sayfaya dön</a></p></div></body></html>"""
    )

    # manifest: commit'e giren dosya. Uçuşkan alan (zaman damgası) KOYMA —
    # yoksa her çalıştırmada commit üretilir ve cron her gün mesaj atar.
    manifest = {
        "source": BASE,
        "pages": [{"url": u, "bytes": n, "file": f} for u, n, f in pages],
        "assets": got_assets + extra,
        "failures": failures,
    }
    json.dump(manifest, open(os.path.join(SITE, "mirror-manifest.json"), "w"),
              indent=2, ensure_ascii=False)

    # tazelik damgası yerelde tutulur (repoya girmez)
    state_dir = os.path.expanduser("~/.hermes/state")
    os.makedirs(state_dir, exist_ok=True)
    stamp = subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"],
                           capture_output=True, text=True).stdout.strip()
    open(os.path.join(state_dir, "cetinserhat_mirror.last"), "w").write(
        f"{stamp} pages={len(pages)} assets={got_assets + extra} "
        f"bytes={sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(SITE) for f in fs)}\n"
    )

    total = sum(os.path.getsize(os.path.join(r, f))
                for r, _, fs in os.walk(SITE) for f in fs)
    print(f"sayfa      : {len(pages)}/{len(urls)}")
    print(f"varlik     : {got_assets + extra} (css-ici ek: {extra})")
    print(f"boyut      : {total/1024:.0f} KB")
    if failures:
        print("BASARISIZ  :")
        for u, e in failures:
            print(f"  - {u} -> {e}")
    return 0 if not failures else 1


def scan():
    hits = []
    compiled = [(p, re.compile(p, re.I)) for p in SECRET_PATTERNS]
    checked = 0
    for root, _, files in os.walk(SITE):
        for fn in files:
            p = os.path.join(root, fn)
            if fn.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico",
                            ".woff", ".woff2", ".ttf", ".mp4")):
                continue
            checked += 1
            try:
                txt = open(p, encoding="utf-8", errors="replace").read()
            except Exception:
                continue
            for pat, rx in compiled:
                for m in rx.finditer(txt):
                    hits.append((os.path.relpath(p, SITE), pat, m.group(0)[:40]))
    print(f"taranan dosya: {checked}")
    if hits:
        print(f"!!! {len(hits)} SIR BENZERI ESLESME — PUSH IPTAL")
        for f, pat, s in hits[:25]:
            print(f"  {f}: /{pat}/ -> {s}")
        return 1
    print("temiz: sir deseni bulunamadi")
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    if cmd == "build":
        rc = build()
        if rc == 0:
            rc = scan()
            print("\nSONUC:", "TEMIZ — push edilebilir" if rc == 0 else "TEMIZ DEGIL — push yok")
        sys.exit(rc)
    elif cmd == "scan":
        sys.exit(scan())
    else:
        sys.exit(__doc__)
