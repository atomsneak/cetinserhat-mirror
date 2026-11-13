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

## Geri alma

Cloudflare panelinde Worker route'unu (`cetinserhat.com/*`) silmek yeterli;
sistem bu repodan tamamen bağımsız çalışmaya devam eder.
