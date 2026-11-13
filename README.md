# cetinserhat-mirror

**Bu repo canlı site DEĞİL.** [cetinserhat.com](https://cetinserhat.com) için
**acil durum statik yedeği**dir. Canlı site Pimini üzerinde (Node + Cloudflare Tünel)
çalışır; buradaki kopya yalnızca origin erişilemez olduğunda bir Cloudflare Worker
tarafından devreye alınır.

## Ne var, ne yok

| Var | Yok |
|---|---|
| 9 sayfanın render edilmiş HTML'i (sitemap'ten) | `data/database.json` (veritabanı) |
| `/assets/` CSS, JS, logo, profil fotoğrafı | `.env`, API anahtarları, Google SSO secret |
| `/uploads/` makale kapak görselleri | `/admin` paneli |
| `robots.txt` (Disallow: /), `404.html` | `/api/*` (form, admin, canlı veri) |

İçerik **beyaz liste** ile alınır: sadece `sitemap.xml`'deki URL'ler ve bu sayfaların
HTML'inde geçen `/assets/`, `/uploads/` yolları. Başka hiçbir yol istenmez.

## Otomatik kapı

`mirror_site.py build` her çalıştığında önce içeriği üretir, sonra **sır taraması**
yapar (`api_key`, `client_secret`, `AIza…`, `sk-…`, `ghp_…`, `BEGIN PRIVATE KEY`,
`Bearer …`). Eşleşme bulursa çıkış kodu **1** olur ve push yapılmaz.

```bash
python3 mirror_site.py build   # aynayı üret + tara
python3 mirror_site.py scan    # sadece tara
```

## Tazelik

- Her makale yayınından sonra (`publish_article.py` sonunda)
- Günde bir kez gece cron'u ile

`docs/mirror-manifest.json` üretim zamanını ve indirilen her URL'yi listeler.

## SEO

Repo public olduğu için `robots.txt` tüm botlara kapalı ve sayfalar
`mirror.cetinserhat.com` altında `noindex` başlığıyla servis edilir — canlı siteyle
kopya içerik çakışması olmaz.

## Kurulu yapı (13.11.2026)

| Bileşen | Değer |
|---|---|
| Worker script | `cetinserhat-failover` |
| Route | `cetinserhat.com/*` → `cetinserhat-failover` |
| Origin (Worker'ın okuduğu) | `https://www.cetinserhat.com` — **route'a DAHİL DEĞİL** (eklenirse sonsuz döngü) |
| Origin timeout | 4 s · ayna timeout 6 s |
| Ayna | `mirror.cetinserhat.com` (CNAME → `atomsneak.github.io`, proxied **kapalı**) |
| Cloudflare zone | `d9d14ac79480496e7f1534e9918849f4` |
| Account | `4c73dfcbbe0900c58b54cfa21c1cb6d4` |

**Davranış:** origin 5xx/erişilemez → ayna denenir. `/api/*` ve `/admin` **asla** aynadan
servis edilmez (503). Yazma istekleri (POST) aynaya düşmez, 503 + JSON döner.

**Ölçülmüş test (13.11.2026):** ayrı `failover-test` hostname + ölü origin kopyası ile
sayfa ve `/assets/` → `200 + x-cetinserhat-mirror: hit`, `/api/posts` ve `/admin` → `503`.
Test kayıtları silindi.

## Worker'ı güncelleme

Token'da Workers yetkisi yok; güncelleme **panel oturumu üzerinden** yapılır: giriş yapmış
`dash.cloudflare.com` sekmesinde `fetch('/api/v4/accounts/<ACC>/workers/scripts/cetinserhat-failover',
{method:'PUT', body: FormData})` — çerez yetkiyi taşır. Alternatif: panel → Workers → servis →
**Edit code** → yapıştır → Deploy.

**Deploy sonrası mutlaka** `node deploy/test-worker.mjs` (origin-up/down senaryoları) ve
canlı `curl -sI https://cetinserhat.com/` (byte'lar değişmemeli).

## Geri alma

Cloudflare panelinde Worker route'unu (`cetinserhat.com/*`) silmek yeterli;
sistem bu repodan tamamen bağımsız çalışmaya devam eder.
