#!/usr/bin/env bash
# Aynayı tazele + sır taramasından geçerse GitHub'a gönder.
# Sır taraması BAŞARISIZ olursa push YAPILMAZ (çıkış kodu 1).
set -uo pipefail
cd "$(dirname "$0")"

echo "→ ayna üretiliyor..."
if ! python3 mirror_site.py build; then
  echo "!!! SIR TARAMASI VEYA İNDİRME BAŞARISIZ — PUSH İPTAL"
  exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "→ değişiklik yok, push gerekmiyor."
  exit 0
fi

git add -A
git commit -q -m "ayna: $(date -u '+%Y-%m-%d %H:%M UTC')" || {
  echo "!!! commit başarısız — push yok"; exit 1; }

# commit'lenmiş yayınlanan içerikte son bir kez daha sır taraması.
# Yalnız docs/ (GitHub Pages'e giden ağaç) taranır: README ve mirror_site.py
# desenleri kendi metinlerinde belgeliyor, onları taramak yanlış alarm verir.
HITS=$(git grep -nIE 'AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY|client_secret["'"'"']?[[:space:]]*[:=]' -- docs ':!docs/*.jpg' ':!docs/*.png' | head -5)
if [ -n "$HITS" ]; then
  echo "!!! COMMIT ICINDE SIR BENZERI ICERIK — PUSH IPTAL"
  echo "$HITS"
  git reset --soft HEAD~1
  exit 1
fi

git push -q origin main && echo "✓ push tamam" || { echo "!!! push başarısız"; exit 1; }
