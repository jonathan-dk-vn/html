/**
 * toc.js — Floating Table of Contents Builder
 * Đặt file này cùng cấp với file HTML, sau đó thêm vào cuối <body>:
 *   <script src="toc.js"></script>
 *
 * Tự động:
 *  • Gán id cho mọi h2 / h3 chưa có id
 *  • Build 1 button floating góc dưới phải
 *  • Click button → panel TOC mở lên phía trên (animate)
 *  • Thu nhỏ → chỉ còn button duy nhất
 *  • Scroll-spy highlight mục đang đọc
 *  • Nhớ trạng thái qua sessionStorage
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────── */
  const HEADING_SELECTORS = 'h2, h3';
  const COLLAPSED_KEY     = 'toc_collapsed';
  const SCROLL_OFFSET     = 80;

  /* ─────────────────────────────────────────────
     1. INJECT STYLES
  ───────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    html { scroll-behavior: smooth; }

    /* === WRAPPER: góc dưới phải, panel mở lên trên === */
    #toc-root {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 13px;
    }

    /* === PANEL (mở lên trên) === */
    #toc-panel {
      background: var(--surface, #fff);
      border-radius: 14px;
      box-shadow:
        0 8px 40px rgba(20,19,28,.18),
        0 2px 8px rgba(20,19,28,.08);
      width: 300px;
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      transform: translateY(12px) scale(0.97);
      transform-origin: bottom right;
      transition:
        max-height .38s cubic-bezier(.4,0,.2,1),
        opacity .28s ease,
        transform .32s cubic-bezier(.4,0,.2,1);
      display: flex;
      flex-direction: column;
      border: 1.5px solid var(--line, #E2E0DB);
      pointer-events: none;
    }
    #toc-panel.open {
      max-height: 70vh;
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* === PANEL HEADER === */
    #toc-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px 10px;
      border-bottom: 1.5px solid var(--line, #E2E0DB);
      flex-shrink: 0;
    }
    #toc-header-icon {
      font-size: 14px;
      color: var(--primary, #3B6FBF);
      flex-shrink: 0;
    }
    #toc-header-title {
      font-weight: 700;
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--ink, #14131C);
      flex: 1;
    }
    #toc-counter {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      background: var(--primary-light, #D6E4FF);
      color: var(--primary-dark, #1A3F80);
      border-radius: 999px;
      padding: 2px 8px;
      flex-shrink: 0;
    }
    #toc-close {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--muted, #6E6B80);
      font-size: 16px;
      line-height: 1;
      padding: 0 0 0 4px;
      display: flex;
      align-items: center;
      transition: color .15s;
    }
    #toc-close:hover { color: var(--ink, #14131C); }

    /* === SCROLLABLE LIST === */
    #toc-list {
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px 0 10px;
      flex: 1;
      scrollbar-width: thin;
      scrollbar-color: var(--primary-mid, #7AAAF5) transparent;
    }
    #toc-list::-webkit-scrollbar { width: 4px; }
    #toc-list::-webkit-scrollbar-thumb {
      background: var(--primary-mid, #7AAAF5);
      border-radius: 4px;
    }

    /* === TOC LINKS === */
    .toc-item {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 5px 14px 5px 14px;
      color: var(--ink, #14131C);
      text-decoration: none;
      line-height: 1.4;
      border-left: 3px solid transparent;
      transition: background .14s, border-color .14s, color .14s;
      overflow: hidden;
    }
    .toc-item-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }
    .toc-item:hover {
      background: var(--primary-light, #D6E4FF);
      color: var(--primary-dark, #1A3F80);
      border-left-color: var(--primary-mid, #7AAAF5);
    }
    .toc-item.active {
      border-left-color: var(--primary, #3B6FBF);
      color: var(--primary, #3B6FBF);
      font-weight: 600;
      background: var(--primary-light, #D6E4FF);
    }
    /* h2 */
    .toc-item[data-level="2"] {
      font-weight: 600;
      font-size: 12.5px;
      padding-top: 7px;
      padding-bottom: 7px;
    }
    /* h3 — thụt vào */
    .toc-item[data-level="3"] {
      padding-left: 26px;
      font-size: 12px;
      color: var(--muted, #6E6B80);
    }
    .toc-item[data-level="3"]:hover { color: var(--primary-dark, #1A3F80); }
    .toc-item[data-level="3"].active { color: var(--primary, #3B6FBF); }

    /* dot marker cho h3 */
    .toc-item[data-level="3"] .toc-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
      opacity: .5;
      margin-top: 1px;
    }

    /* === FAB BUTTON (thu nhỏ → chỉ còn button này) === */
    #toc-btn {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: var(--primary, #3B6FBF);
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow:
        0 4px 20px rgba(59,111,191,.45),
        0 1px 4px rgba(20,19,28,.15);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition:
        background .2s,
        box-shadow .2s,
        transform .2s cubic-bezier(.34,1.56,.64,1);
      position: relative;
      outline: none;
    }
    #toc-btn:hover {
      background: var(--primary-dark, #1A3F80);
      box-shadow: 0 6px 28px rgba(59,111,191,.55);
      transform: scale(1.08);
    }
    #toc-btn:active { transform: scale(.94); }

    /* Icon bên trong FAB */
    #toc-btn-icon {
      font-size: 20px;
      line-height: 1;
      transition: transform .35s cubic-bezier(.4,0,.2,1), opacity .2s;
      position: absolute;
    }
    #toc-btn-icon.icon-open  { opacity: 1;  transform: rotate(0deg) scale(1); }
    #toc-btn-icon.icon-close { opacity: 0;  transform: rotate(-90deg) scale(.6); }
    #toc-panel.open ~ #toc-btn .icon-open  { opacity: 0;  transform: rotate(90deg) scale(.6); }
    #toc-panel.open ~ #toc-btn .icon-close { opacity: 1;  transform: rotate(0deg) scale(1); }

    /* Pulse ring khi đóng (gợi ý người dùng) */
    #toc-btn::after {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid var(--primary, #3B6FBF);
      opacity: 0;
      transform: scale(1);
      transition: none;
    }
    #toc-root:not(.panel-open) #toc-btn::after {
      animation: toc-pulse 2.8s ease-out 1.2s infinite;
    }
    @keyframes toc-pulse {
      0%   { opacity: .6; transform: scale(1); }
      70%  { opacity: 0;  transform: scale(1.55); }
      100% { opacity: 0;  transform: scale(1.55); }
    }

    /* Badge: số mục active hiển thị khi panel đóng */
    #toc-badge {
      position: absolute;
      top: -3px;
      right: -3px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      background: var(--error, #E8344A);
      color: #fff;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'DM Mono', monospace;
      box-shadow: 0 1px 4px rgba(20,19,28,.2);
      opacity: 0;
      transform: scale(.6);
      transition: opacity .2s, transform .2s cubic-bezier(.34,1.56,.64,1);
    }
    #toc-root:not(.panel-open) #toc-badge.visible {
      opacity: 1;
      transform: scale(1);
    }

    @media (max-width: 480px) {
      #toc-root { bottom: 16px; right: 16px; }
      #toc-panel { width: calc(100vw - 32px); }
    }
  `;
  document.head.appendChild(style);

  /* ─────────────────────────────────────────────
     2. COLLECT & ID HEADINGS
  ───────────────────────────────────────────── */
  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
  }

  const usedIds = new Set();
  function ensureId(el) {
    if (el.id) { usedIds.add(el.id); return el.id; }
    let base = slugify(el.textContent || '');
    if (!base) base = 'heading';
    let id = base, n = 1;
    while (usedIds.has(id) || document.getElementById(id)) id = `${base}-${n++}`;
    el.id = id;
    usedIds.add(id);
    return id;
  }

  const headings = Array.from(document.querySelectorAll(HEADING_SELECTORS))
    .filter(el => !el.closest('#toc-root') && el.textContent.trim().length > 0);

  headings.forEach(ensureId);

  /* ─────────────────────────────────────────────
     3. BUILD DOM
  ───────────────────────────────────────────── */
  const savedOpen = sessionStorage.getItem(COLLAPSED_KEY) !== 'true'; // default: open

  /* --- Root wrapper --- */
  const tocRoot = document.createElement('div');
  tocRoot.id = 'toc-root';

  /* --- Panel --- */
  const tocPanel = document.createElement('div');
  tocPanel.id = 'toc-panel';

  /* --- Panel header --- */
  const tocHeader = document.createElement('div');
  tocHeader.id = 'toc-header';
  tocHeader.innerHTML = `
    <span id="toc-header-icon">☰</span>
    <span id="toc-header-title">Mục lục</span>
    <span id="toc-counter">${headings.length}</span>
    <button id="toc-close" title="Thu nhỏ" aria-label="Đóng mục lục">✕</button>
  `;

  /* --- List --- */
  const tocList = document.createElement('div');
  tocList.id = 'toc-list';
  tocList.setAttribute('role', 'list');

  headings.forEach(h => {
    const level = parseInt(h.tagName[1]);
    const a = document.createElement('a');
    a.className = 'toc-item';
    a.dataset.level = String(level);
    a.href = `#${h.id}`;
    a.setAttribute('role', 'listitem');
    a.title = h.textContent.trim();

    if (level === 3) {
      const dot = document.createElement('span');
      dot.className = 'toc-dot';
      a.appendChild(dot);
    }

    const span = document.createElement('span');
    span.className = 'toc-item-text';
    span.textContent = h.textContent.trim().replace(/\s+/g, ' ');
    a.appendChild(span);

    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.getElementById(h.id);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
      window.scrollTo({ top, behavior: 'smooth' });
      // Trên mobile: đóng panel sau khi chọn
      if (window.innerWidth < 600) setOpen(false);
    });

    tocList.appendChild(a);
  });

  /* --- FAB button --- */
  const tocBtn = document.createElement('button');
  tocBtn.id = 'toc-btn';
  tocBtn.title = 'Mục lục';
  tocBtn.setAttribute('aria-label', 'Mở / đóng mục lục');
  tocBtn.innerHTML = `
    <span id="toc-btn-icon" class="icon-open">☰</span>
    <span id="toc-btn-icon" class="icon-close">✕</span>
    <span id="toc-badge"></span>
  `;
  // Fix: dùng 2 span riêng biệt với id khác nhau
  tocBtn.innerHTML = `
    <span class="icon-open"  style="font-size:20px;line-height:1;position:absolute;transition:transform .35s cubic-bezier(.4,0,.2,1),opacity .2s;">☰</span>
    <span class="icon-close" style="font-size:18px;line-height:1;position:absolute;transition:transform .35s cubic-bezier(.4,0,.2,1),opacity .2s;opacity:0;transform:rotate(-90deg) scale(.6)">✕</span>
    <span id="toc-badge"></span>
  `;

  /* --- Assemble --- */
  tocPanel.appendChild(tocHeader);
  tocPanel.appendChild(tocList);
  tocRoot.appendChild(tocPanel);
  tocRoot.appendChild(tocBtn);
  document.body.appendChild(tocRoot);

  /* ─────────────────────────────────────────────
     4. OPEN / CLOSE
  ───────────────────────────────────────────── */
  const iconOpen  = tocBtn.querySelector('.icon-open');
  const iconClose = tocBtn.querySelector('.icon-close');
  const tocBadge  = tocBtn.querySelector('#toc-badge');
  const closeBtn  = tocHeader.querySelector('#toc-close');

  function setOpen(open, animate = true) {
    if (!animate) {
      tocPanel.style.transition = 'none';
      void tocPanel.offsetWidth;
    }

    if (open) {
      tocPanel.classList.add('open');
      tocRoot.classList.add('panel-open');
      // FAB icon: ☰ → ✕
      iconOpen.style.opacity  = '0';
      iconOpen.style.transform = 'rotate(90deg) scale(.6)';
      iconClose.style.opacity  = '1';
      iconClose.style.transform = 'rotate(0deg) scale(1)';
    } else {
      tocPanel.classList.remove('open');
      tocRoot.classList.remove('panel-open');
      // FAB icon: ✕ → ☰
      iconOpen.style.opacity  = '1';
      iconOpen.style.transform = 'rotate(0deg) scale(1)';
      iconClose.style.opacity  = '0';
      iconClose.style.transform = 'rotate(-90deg) scale(.6)';
    }

    if (!animate) {
      void tocPanel.offsetWidth;
      tocPanel.style.transition = '';
    }

    sessionStorage.setItem(COLLAPSED_KEY, String(!open));
  }

  // Khởi tạo (không animate)
  setOpen(savedOpen, false);

  tocBtn.addEventListener('click', () => {
    setOpen(!tocPanel.classList.contains('open'));
  });

  closeBtn.addEventListener('click', () => setOpen(false));

  // Đóng khi click ra ngoài
  document.addEventListener('click', e => {
    if (tocPanel.classList.contains('open') &&
        !tocRoot.contains(e.target)) {
      setOpen(false);
    }
  });

  /* ─────────────────────────────────────────────
     5. SCROLL SPY
  ───────────────────────────────────────────── */
  const tocLinks = Array.from(tocList.querySelectorAll('.toc-item'));
  let activeIdx  = -1;

  function onScroll() {
    const scrollY = window.scrollY + SCROLL_OFFSET + 20;
    let newIdx = -1;

    for (let i = headings.length - 1; i >= 0; i--) {
      if (headings[i].getBoundingClientRect().top + window.scrollY <= scrollY) {
        newIdx = i; break;
      }
    }

    if (newIdx === activeIdx) return;
    activeIdx = newIdx;

    tocLinks.forEach((a, i) => a.classList.toggle('active', i === newIdx));

    // Badge: số thứ tự mục đang đọc
    if (newIdx >= 0) {
      const h2Count = headings.slice(0, newIdx + 1).filter(h => h.tagName === 'H2').length;
      tocBadge.textContent = h2Count || '';
      tocBadge.classList.toggle('visible', h2Count > 0);
    } else {
      tocBadge.classList.remove('visible');
    }

    // Auto-scroll active item vào view trong list
    const activeEl = tocList.querySelector('.toc-item.active');
    if (activeEl && tocPanel.classList.contains('open')) {
      const itemTop    = activeEl.offsetTop;
      const itemBottom = itemTop + activeEl.offsetHeight;
      const listTop    = tocList.scrollTop;
      const listBottom = listTop + tocList.clientHeight;
      if (itemTop < listTop + 30) {
        tocList.scrollTo({ top: itemTop - 30, behavior: 'smooth' });
      } else if (itemBottom > listBottom - 30) {
        tocList.scrollTo({ top: itemBottom - tocList.clientHeight + 30, behavior: 'smooth' });
      }
    }
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => { onScroll(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });

  onScroll();

})();