/**
 * assets/article-render.js — Makale markdown motoru (tek kaynak).
 *
 * NEDEN: Ayni render iki yerde lazim.
 *   - Sunucu (/blog/:slug): govdeyi SUNUCUDA bassin diye (JS kapali/bot icin dogru icerik).
 *   - Tarayici (post.html): /post.html'e dogrudan girildiginde yedek yol.
 * Iki ayri kopya tutmak yerine tek dosya iki ortamda calisir.
 *
 * DESTEKLENEN SOZDIZIMI (olculdu: canli DB'deki 9 yazinin tamami tarandi):
 *   ##/###/# baslik, **kalin**, *italik*, > alinti, - madde, 1. numarali liste,
 *   | tablo |, --- yatay cizgi, [metin](https://...) baglanti, bos satir = paragraf.
 *
 * GUVENLIK: Tum metin once escapeHtml'den gecer, sonra bicimlendirilir. Yani DB'deki
 * icerik HTML olarak YORUMLANMAZ -> admin hesabi ele gecse bile stored XSS olusmaz.
 * (Olculdu: canli DB'de 0 adet '<' karakteri var; yine de kacis zorunlu tutuldu.)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArticleRender = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Satir ici bicimlendirme. Girdi ARTIK kacislanmis metindir.
  function inline(text) {
    var s = text;
    // baglanti: [metin](https://...) — sadece http(s) kabul edilir (javascript: elenir)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, function (m, label, url) {
      return '<a href="' + url + '" class="text-primary underline underline-offset-2 decoration-primary/40 hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em class="italic text-primary-container">$2</em>');
    return s;
  }

  function heading(tag, text) {
    var cls = {
      1: 'font-headline-lg text-headline-lg text-text-high-contrast mt-8 mb-4 font-extrabold',
      2: 'font-headline-md text-headline-md text-text-high-contrast mt-8 mb-4 font-bold',
      3: 'font-headline-sm text-headline-sm text-text-high-contrast mt-6 mb-3 font-semibold',
      4: 'font-headline-sm text-base text-text-high-contrast mt-5 mb-2 font-semibold'
    }[tag] || 'font-headline-sm text-text-high-contrast mt-6 mb-3 font-semibold';
    return '<h' + tag + ' class="' + cls + '">' + text + '</h' + tag + '>';
  }

  // | a | b |  +  | :--- | ---: |
  function splitRow(line) {
    var t = line.trim();
    if (t.charAt(0) === '|') t = t.slice(1);
    if (t.charAt(t.length - 1) === '|') t = t.slice(0, -1);
    return t.split('|').map(function (c) { return c.trim(); });
  }

  function isTableSeparator(line) {
    if (!line) return false;
    var t = line.trim();
    if (t.indexOf('|') === -1 && t.indexOf('-') === -1) return false;
    return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(t);
  }

  function renderTable(header, aligns, body) {
    var th = header.map(function (c, i) {
      return '<th class="px-3 py-2.5 text-left font-semibold text-white border-b border-white/[0.12] align-bottom">' + c + '</th>';
    }).join('');
    var rows = body.map(function (cells) {
      var tds = cells.map(function (c, i) {
        var align = aligns[i] || 'left';
        return '<td class="px-3 py-2.5 align-top border-b border-white/[0.06]' +
          (align === 'center' ? ' text-center' : align === 'right' ? ' text-right' : '') + '">' + c + '</td>';
      }).join('');
      return '<tr class="hover:bg-white/[0.03] transition-colors">' + tds + '</tr>';
    }).join('');
    return '<div class="my-6 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0d1117]">' +
      '<table class="w-full border-collapse text-xs sm:text-sm text-on-surface-variant">' +
      '<thead><tr class="bg-white/[0.04]">' + th + '</tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function renderMarkdown(md) {
    if (!md) return '';
    var lines = String(md).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var para = [];
    var i = 0;

    function flushPara() {
      if (!para.length) return;
      var text = para.join(' ').replace(/\s+/g, ' ').trim();
      para = [];
      if (!text) return;
      out.push('<p class="font-body-md text-body-md text-on-surface-variant leading-relaxed my-4">' + inline(text) + '</p>');
    }

    while (i < lines.length) {
      var raw = lines[i];
      var line = raw.trim();

      if (!line) { flushPara(); i++; continue; }

      // --- yatay cizgi
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
        flushPara();
        out.push('<hr class="my-8 border-white/[0.08]">');
        i++;
        continue;
      }

      // baslik
      var h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h) {
        flushPara();
        out.push(heading(h[1].length, inline(h[2].trim())));
        i++;
        continue;
      }

      // tablo
      if (line.charAt(0) === '|' && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        flushPara();
        var header = splitRow(line).map(function (c) { return inline(c); });
        var aligns = splitRow(lines[i + 1]).map(function (c) {
          var l = c.indexOf(':') === 0, r = c.lastIndexOf(':') === c.length - 1;
          return (l && r) ? 'center' : r ? 'right' : 'left';
        });
        i += 2;
        var body = [];
        while (i < lines.length && lines[i].trim().charAt(0) === '|') {
          body.push(splitRow(lines[i]).map(function (c) { return inline(c); }));
          i++;
        }
        out.push(renderTable(header, aligns, body));
        continue;
      }

      // alinti
      if (line.charAt(0) === '>') {
        flushPara();
        var quote = [];
        while (i < lines.length && lines[i].trim().charAt(0) === '>') {
          quote.push(inline(escapeHtml(lines[i].trim().replace(/^>\s?/, ''))));
          i++;
        }
        out.push('<blockquote class="border-l-4 border-primary pl-4 py-2 my-4 text-text-muted italic bg-surface-container rounded-r-lg">' + quote.join('<br>') + '</blockquote>');
        continue;
      }

      // madde listesi
      if (/^[-*+]\s+/.test(line)) {
        flushPara();
        var ul = [];
        while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
          ul.push('<li class="flex items-start gap-2 my-1.5"><span class="text-primary-container mt-1 shrink-0">•</span><span>' +
            inline(escapeHtml(lines[i].trim().replace(/^[-*+]\s+/, ''))) + '</span></li>');
          i++;
        }
        out.push('<ul class="my-4 pl-1">' + ul.join('') + '</ul>');
        continue;
      }

      // numarali liste
      if (/^\d+[.)]\s+/.test(line)) {
        flushPara();
        var ol = [];
        while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
          var item = lines[i].trim();
          var num = /^(\d+)[.)]\s+/.exec(item)[1];
          ol.push('<li class="flex items-start gap-2 my-1.5"><span class="text-primary font-mono text-sm mt-1 shrink-0">' + num + '.</span><span>' +
            inline(escapeHtml(item.replace(/^\d+[.)]\s+/, ''))) + '</span></li>');
          i++;
        }
        out.push('<ol class="my-4 pl-1">' + ol.join('') + '</ol>');
        continue;
      }

      para.push(escapeHtml(line));
      i++;
    }
    flushPara();
    return out.join('\n');
  }

  // Baslik/ozet gibi tek satirlik alanlar icin: markdown bicimi olmadan, sadece kacis.
  function plainText(str) {
    return escapeHtml(str).replace(/\s+/g, ' ').trim();
  }

  return { escapeHtml: escapeHtml, renderMarkdown: renderMarkdown, plainText: plainText };
});
