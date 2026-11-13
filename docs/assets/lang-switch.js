/**
 * Ultra-Smooth & Layout-Stable Language Switcher Engine
 */
window.isLangSwitching = false;

window.smoothSwitchLang = async function(targetLang) {
  const currentLang = document.documentElement.lang || 'tr';
  if (currentLang === targetLang || window.isLangSwitching) return;

  const currentPath = window.location.pathname;
  // [2026-10-25] Teşekkür sayfaları birbirine geçer, ana sayfaya değil:
  // ölçüldü — /tesekkurler'de EN'e basınca kullanıcı /en ana sayfasına düşüyordu.
  const LANG_PAIR = {
    '/tesekkurler': '/thanks', '/tesekkurler.html': '/thanks',
    '/thanks': '/tesekkurler', '/thanks.html': '/tesekkurler'
  };
  if (LANG_PAIR[currentPath]) {
    window.location.href = LANG_PAIR[currentPath];
    return;
  }
  if (currentPath !== '/' && currentPath !== '/en') {
    window.location.href = targetLang === 'en' ? '/en' : '/';
    return;
  }

  const btnTr = document.getElementById('lang-btn-tr');
  const btnEn = document.getElementById('lang-btn-en');
  const main = document.querySelector('main');

  window.isLangSwitching = true;

  // 1. Lock current main height during transition to strictly prevent window/scrollbar jitter
  if (main) {
    const currentHeight = main.offsetHeight;
    main.style.minHeight = `${currentHeight}px`;
    main.classList.remove('page-fade-in');
    main.classList.add('page-fade-out');
  }

  // 2. Animate language switch button states with strictly locked sizing
  const activeClass = 'flex-1 h-9 text-[11px] sm:text-xs flex items-center justify-center rounded-full text-center transition-all duration-200 bg-primary/20 border border-primary/40 text-primary shrink-0 cursor-pointer select-none';
  const passiveClass = 'flex-1 h-9 text-[11px] sm:text-xs flex items-center justify-center rounded-full text-center transition-all duration-200 text-text-muted hover:text-white border border-transparent shrink-0 cursor-pointer select-none';

  if (targetLang === 'en') {
    if (btnTr) btnTr.className = passiveClass;
    if (btnEn) btnEn.className = activeClass;
  } else {
    if (btnTr) btnTr.className = activeClass;
    if (btnEn) btnEn.className = passiveClass;
  }

  const targetUrl = targetLang === 'en' ? '/en' : '/';

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) throw new Error('Page fetch failed');
    const htmlText = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Wait 120ms for ultra-responsive cross-fade
    await new Promise(r => setTimeout(r, 130));

    // Update Document Meta
    document.title = doc.title;
    document.documentElement.lang = targetLang;

    // Swap <main> content
    const newMain = doc.querySelector('main');
    if (newMain && main) {
      main.innerHTML = newMain.innerHTML;
    }

    // Swap navigation links in header (for language-specific labels & hrefs)
    const currentNav = document.querySelector('header nav');
    const newNav = doc.querySelector('header nav');
    if (currentNav && newNav) {
      currentNav.innerHTML = newNav.innerHTML;
      if (newNav.getAttribute('data-active-classes')) {
        currentNav.setAttribute('data-active-classes', newNav.getAttribute('data-active-classes'));
      }
    }

    // Swap CTA button text in header
    const currentCta = document.querySelector('header a[href*="iletisim"], header a[href*="contact"]');
    const newCta = doc.querySelector('header a[href*="iletisim"], header a[href*="contact"]');
    if (currentCta && newCta) {
      currentCta.textContent = newCta.textContent;
      currentCta.setAttribute('href', newCta.getAttribute('href'));
    }

    // Sync lang-toggle-container exactly from target page
    const currentLangToggle = document.getElementById('lang-toggle-container');
    const newLangToggle = doc.getElementById('lang-toggle-container');
    if (currentLangToggle && newLangToggle) {
      currentLangToggle.innerHTML = newLangToggle.innerHTML;
    }

    // Swap footer content
    const currentFooter = document.querySelector('footer');
    const newFooter = doc.querySelector('footer');
    if (currentFooter && newFooter) {
      currentFooter.innerHTML = newFooter.innerHTML;
    }

    // Update browser URL without page reload
    window.history.pushState({ lang: targetLang }, '', targetUrl);

    // Re-initialize dynamic components if available
    if (typeof loadHomepageVideos === 'function') {
      loadHomepageVideos();
    }

    // Release minHeight lock gracefully after content paint
    requestAnimationFrame(() => {
      if (main) {
        main.style.minHeight = '';
        main.classList.remove('page-fade-out');
        main.classList.add('page-fade-in');
      }
    });
  } catch (err) {
    console.warn('Smooth transition fallback to standard navigation:', err);
    window.location.href = targetUrl;
  } finally {
    window.isLangSwitching = false;
  }
};

// Handle browser Back / Forward buttons smoothly
window.addEventListener('popstate', (e) => {
  const path = window.location.pathname;
  if (path === '/en' || path.startsWith('/en/')) {
    if (document.documentElement.lang !== 'en') {
      window.smoothSwitchLang('en');
    }
  } else {
    if (document.documentElement.lang !== 'tr') {
      window.smoothSwitchLang('tr');
    }
  }
});
