/**
 * assets/post-list.js — Blog LİSTE kartı motoru (tek kaynak).
 *
 * NEDEN: Ayni kart HTML'i iki yerde lazim.
 *   - Sunucu (/blog, /gonderiler, /posts): liste SUNUCUDA basilsin diye. Boylece
 *     JS kapali bot/okuyucu bos sayfa gormez (olculdu: once sunucudan gelen
 *     /blog HTML'inde 0 yazi karti ve 0 "/blog/<slug>" baglantisi vardi).
 *   - Tarayici (blog.html): filtre/arama sonrasi ayni karti yeniden cizmek icin.
 * Iki kopya tutmak yerine tek dosya iki ortamda calisir (article-render.js ile ayni desen).
 *
 * GUVENLIK: Eskiden blog.html kart sablonu DB alanlarini kacissiz basiyordu
 * (`${item.title}`), yani admin panelinden gelen baslik/etiket HTML olarak
 * YORUMLANIYORDU (stored XSS). Burada tum metin alanlari escapeHtml'den gecer;
 * url alanlari yalnizca "/..." veya http(s):// kabul eder, youtubeId desen dogrular.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./article-render'));
  } else {
    root.PostList = factory(root.ArticleRender);
  }
})(typeof self !== 'undefined' ? self : this, function (articleRender) {
  'use strict';

  var escapeHtml = articleRender.escapeHtml;

  // Tek satirlik metin: kacis + bosluk sadelestirme.
  function text(str) {
    return articleRender.plainText(str);
  }

  // Yalnizca goreli yol veya http(s) kabul edilir; javascript:/data: elenir.
  function safeUrl(url, fallback) {
    var s = String(url === null || url === undefined ? '' : url).trim();
    if (!s) return fallback || '#';
    if (s.charAt(0) === '/' && s.charAt(1) !== '/') return s;
    if (/^https?:\/\//i.test(s)) return s;
    return fallback || '#';
  }

  function ytId(id) {
    var s = String(id === null || id === undefined ? '' : id).trim();
    return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : '';
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function renderArticleCard(item) {
    var title = text(item.title || '');
    var url = safeUrl(item.url, '#');
    var cover = item.coverImage ? safeUrl(item.coverImage, '') : '';
    var excerpt = text(item.excerpt || '');
    var tags = Array.isArray(item.tags) ? item.tags : [];
    var readTime = text(item.readTime || '4 dk');
    var date = text(formatDate(item.createdAt));
    var featured = Boolean(item.featured);

    var tagChips = tags.map(function (t) {
      return '<span class="px-2.5 py-1 rounded-full bg-[#1c2331] border border-white/[0.08] hover:border-primary/40 hover:text-primary transition-colors text-on-surface font-mono-code text-xs">' +
        escapeHtml(t) + '</span>';
    }).join('');

    var coverBlock = cover ? `
                <a href="${url}" class="block w-full aspect-[40/21] sm:aspect-[40/21] rounded-2xl overflow-hidden bg-[#090b0e] border border-white/[0.08] relative group/cover mt-1 mb-2">
                  <img src="${cover}" alt="${title}" loading="lazy" decoding="async" class="w-full h-full object-cover transition-transform duration-500 group-hover/cover:scale-[1.03]" onerror="this.parentElement.style.display='none'">
                  <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
                </a>` : '';

    return `
          <article data-post-id="${escapeHtml(item.id || '')}" data-post-type="article" class="p-5 sm:p-space-xl md:p-space-2xl rounded-3xl bg-gradient-to-br from-[#1c2432] via-[#131822] to-[#0b0e13] hover:from-[#222c3d] hover:via-[#161d2a] hover:to-[#0d1017] border ${featured ? 'border-primary/50 ring-1 ring-primary/25 shadow-[0_8px_32px_rgba(30,165,252,0.18)] hover:border-primary/70' : 'border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.36)] hover:border-primary/40'} hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)] transition-all duration-300 flex flex-col justify-between gap-space-lg group relative overflow-hidden">
            <div class="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/0 group-hover:via-primary to-transparent transition-all duration-500"></div>

            <div class="flex flex-col gap-space-sm">
              <!-- Meta Tags & Read Time -->
              <div class="flex flex-wrap items-center justify-between gap-space-sm">
                <div class="flex flex-wrap items-center gap-space-xs">
                  <span class="px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-label-md text-xs font-semibold flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    <span>Makale / Blog</span>
                  </span>
                  ${featured ? '<span class="px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 font-label-md text-xs font-semibold flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">star</span><span>Öne Çıkan</span></span>' : ''}
                  ${tagChips}
                </div>
                <span class="inline-flex items-center gap-1 font-body-sm text-body-sm text-secondary">
                  <span class="material-symbols-outlined text-[15px] text-primary">timer</span>
                  <span>${readTime} okuma</span>
                </span>
              </div>
${coverBlock}

              <!-- Title -->
              <h2 class="font-headline-md text-headline-sm md:text-headline-md text-on-surface group-hover:text-primary transition-colors tracking-tight">
                <a href="${url}" class="block">
                  ${title}
                </a>
              </h2>

              <!-- Excerpt -->
              <p class="font-body-md text-body-md text-secondary leading-relaxed line-clamp-3">
                ${excerpt}
              </p>
            </div>

            <!-- Footer Bar of Card -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-space-md border-t border-white/[0.06]">
              <span class="inline-flex items-center gap-1.5 font-body-sm text-xs sm:text-body-sm text-secondary shrink-0">
                <span class="material-symbols-outlined text-[15px] text-primary">calendar_today</span>
                <span>${date}</span>
              </span>

              <div class="flex items-center gap-2 sm:gap-2.5 flex-nowrap shrink-0">
                <a href="${url}?readmode=1" title="Dikkat dağıtıcı unsurlar olmadan Okuma Modunda aç" class="inline-flex items-center justify-center gap-1 sm:gap-space-xs px-3 sm:px-space-md py-1.5 sm:py-space-xs rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-on-primary font-label-md text-xs sm:text-label-md font-semibold border border-primary/30 hover:border-transparent transition-all whitespace-nowrap shadow-sm">
                  <span class="material-symbols-outlined text-[15px] sm:text-[16px]">chrome_reader_mode</span>
                  <span>Okuma Modu</span>
                </a>
                <a href="${url}" class="inline-flex items-center justify-center gap-1 sm:gap-space-xs px-3 sm:px-space-md py-1.5 sm:py-space-xs rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-on-primary font-label-md text-xs sm:text-label-md font-semibold border border-primary/30 hover:border-transparent transition-all whitespace-nowrap shadow-sm">
                  <span>Yazıyı Oku</span>
                  <span class="material-symbols-outlined text-[15px] sm:text-[16px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
                </a>
              </div>
            </div>
          </article>
        `;
  }

  function renderVideoCard(item) {
    var title = text(item.title || '');
    var url = safeUrl(item.youtubeUrl, '#');
    var id = ytId(item.youtubeId);
    var thumb = id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : '/assets/og-image.png';
    var date = text(formatDate(item.createdAt));
    var featured = Boolean(item.featured);

    return `
            <article data-post-id="${escapeHtml(item.id || '')}" data-post-type="video" class="p-space-lg md:p-space-xl rounded-3xl bg-gradient-to-br from-[#1c2432] via-[#131822] to-[#0b0e13] hover:from-[#222c3d] hover:via-[#161d2a] hover:to-[#0d1017] border border-white/[0.1] hover:border-primary/40 transition-all duration-300 flex flex-col md:flex-row gap-space-lg group shadow-[0_8px_32px_rgba(0,0,0,0.36)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div class="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/0 group-hover:via-red-500 to-transparent transition-all duration-500"></div>

              <!-- Video Thumbnail with Play overlay -->
              <div class="w-full md:w-72 sm:w-80 shrink-0 aspect-video rounded-2xl overflow-hidden relative bg-[#090b0e] border border-white/[0.08] group/thumb">
                <img src="${thumb}" alt="${title}" loading="lazy" decoding="async" class="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-105" onerror="this.src='/assets/og-image.png'">
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="absolute inset-0 bg-black/40 hover:bg-black/20 flex items-center justify-center transition-all group/play" title="YouTube'da İzle">
                  <div class="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover/play:scale-110 group-hover/play:bg-red-600 transition-all">
                    <span class="material-symbols-outlined text-[26px] ml-0.5" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                  </div>
                </a>
                <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[11px] font-semibold bg-black/80 text-white flex items-center gap-1">
                  <span class="material-symbols-outlined text-[13px] text-red-500">smart_display</span>
                  <span>Video</span>
                </span>
              </div>

              <!-- Video Content Info -->
              <div class="flex flex-col justify-between flex-1 gap-space-sm">
                <div class="flex flex-col gap-space-xs">
                  <div class="flex flex-wrap items-center justify-between gap-space-sm">
                    <div class="flex items-center gap-2">
                      <span class="px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-label-md text-xs font-semibold flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        <span>YouTube Video</span>
                      </span>
                      ${featured ? '<span class="px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-label-md text-[11px] font-semibold">Öne Çıkan</span>' : ''}
                    </div>
                    <span class="inline-flex items-center gap-1 font-body-sm text-body-sm text-secondary">
                      <span class="material-symbols-outlined text-[15px] text-primary">calendar_today</span>
                      <span>${date}</span>
                    </span>
                  </div>

                  <h2 class="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors tracking-tight mt-1">
                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="hover:underline">
                      ${title}
                    </a>
                  </h2>

                  <p class="font-body-md text-body-md text-secondary line-clamp-2 leading-relaxed">
                    Serhat Çetin resmi YouTube kanalında paylaşılan teknik eğitim videosu ve mimari gösterim.
                  </p>
                </div>

                <div class="flex items-center justify-between pt-space-sm border-t border-white/[0.06] mt-auto">
                  <span class="text-xs text-secondary font-medium">Platform: YouTube</span>
                  <a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white font-label-md text-label-md font-semibold border border-red-500/30 hover:border-transparent transition-all">
                    <span>Videoyu İzle</span>
                    <span class="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-0.5">open_in_new</span>
                  </a>
                </div>
              </div>
            </article>
          `;
  }

  function renderCard(item) {
    if (!item || typeof item !== 'object') return '';
    return item.type === 'video' ? renderVideoCard(item) : renderArticleCard(item);
  }

  // Kart listesi. Bos liste icin arama sonucu bos durumu doner.
  function renderList(items, opts) {
    var list = Array.isArray(items) ? items : [];
    var emptyMessage = (opts && opts.emptyMessage) || 'Henüz yayınlanmış bir gönderi yok.';
    if (list.length === 0) {
      return `
          <div class="p-space-2xl rounded-3xl bg-gradient-to-br from-[#1c2432] via-[#131822] to-[#0b0e13] border border-white/[0.1] text-center flex flex-col items-center justify-center gap-3 py-16 shadow-[0_8px_32px_rgba(0,0,0,0.36)]">
            <span class="material-symbols-outlined text-[48px] text-secondary">manage_search</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Eşleşen gönderi bulunamadı.</h3>
            <p class="font-body-md text-body-md text-secondary max-w-md">${escapeHtml(emptyMessage)}</p>
          </div>
        `;
    }
    return list.map(renderCard).join('');
  }

  return {
    renderCard: renderCard,
    renderList: renderList,
    formatDate: formatDate,
    safeUrl: safeUrl
  };
});
