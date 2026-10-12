// ==UserScript==
// @name         Reels Blocker – Facebook
// @namespace    reels-blocker
// @version      1.0.0
// @description  Blocks Facebook Reels. A reel someone sends you still opens, but only that one reel – no scrolling on to the next.
// @match        *://*.facebook.com/*
// @run-at       document-start
// @inject-into  content
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---- Settings (edit these) ----------------------------------------------
  const SETTINGS = {
    // true: a single reel only opens from Messages or from a facebook.com/reel/...
    //       link opened from another app (e.g. Messenger, iMessage).
    // false: a single reel may also be opened from profiles, pages, etc.
    reelsOnlyFromMessages: true,
    // Open the Friends feed (posts from your friends, newest first) instead of
    // the algorithmic home feed.
    friendsFeedByDefault: true,
    // Block the Video/Watch tab feed (mostly reels). Single shared videos
    // (…/watch/?v=123) still open.
    blockWatchFeed: true,
  };

  // ---- Pure logic (unit tested in tests/) -----------------------------------

  function classifyPath(path, search) {
    search = search || '';
    if (/^\/reels?\/?$/.test(path)) return { type: 'reelsFeed' };
    const reel = path.match(/^\/reels?\/([A-Za-z0-9_-]+)\/?$/);
    if (reel) return { type: 'reel', id: reel[1] };
    if (/^\/watch(\/|$)/.test(path)) {
      return /[?&]v=/.test(search) ? { type: 'video' } : { type: 'watchFeed' };
    }
    if (/^\/[^/]+\/reels\/?$/.test(path) || /[?&]sk=reels_tab/.test(search)) {
      return { type: 'profileReels' };
    }
    if (/^\/messages(\/|$)/.test(path)) return { type: 'messages' };
    if (path === '/' || path === '/home.php') return { type: 'home' };
    return { type: 'other' };
  }

  // prevPath is null on a fresh page load (link from another app, reload).
  // Returns { action: 'allow', remember? } or { action: 'block', message, to }
  // where `to` null means "go back to the last non-reel page".
  function decideNavigation(prevPath, curPath, curSearch, allowedReelId, settings) {
    const cur = classifyPath(curPath, curSearch);
    if (cur.type === 'reelsFeed' || cur.type === 'profileReels') {
      return { action: 'block', message: 'Reels are blocked', to: null };
    }
    if (cur.type === 'watchFeed' && settings.blockWatchFeed) {
      return { action: 'block', message: 'Video feed is blocked', to: null };
    }
    if (cur.type !== 'reel') return { action: 'allow' };
    if (cur.id === allowedReelId) return { action: 'allow' };
    if (prevPath === null) return { action: 'allow', remember: cur.id };

    const prev = classifyPath(prevPath, '');
    if (prev.type === 'reel') {
      // Moving from one reel straight to another = scrolling the reels feed.
      return { action: 'block', message: 'One reel only – you’re back where you were', to: null };
    }
    if (settings.reelsOnlyFromMessages && prev.type !== 'messages') {
      return { action: 'block', message: 'Reels only open from your messages', to: prevPath };
    }
    return { action: 'allow', remember: cur.id };
  }

  function friendsFeedUrl(path, search) {
    if (path !== '/' && path !== '/home.php') return null;
    if (/[?&](sk|filter)=/.test(search)) return null;
    return '/?filter=friends&sk=h_chr';
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { classifyPath, decideNavigation, friendsFeedUrl };
    return;
  }

  // ---- Browser runtime ---------------------------------------------------------

  const KEY = 'reelsBlocker:';
  const store = {
    get(k) { try { return sessionStorage.getItem(KEY + k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(KEY + k, v); } catch (e) { /* ignore */ } },
  };

  const CSS = `
    /* Reels / Video tab links */
    a[href="/reel/"], a[href^="/reel/?"], a[href="/reels/"], a[href$="/reels/"],
    a[href*="sk=reels_tab"] { display: none !important; }
    html.rb-block-watch a[href="/watch/"], html.rb-block-watch a[href^="/watch/?"]:not([href*="v="]),
    html.rb-block-watch a[href="/watch"] { display: none !important; }

    /* Reels in the feed and on profiles (not in Messages). */
    html.rb-hide-reels a[href*="/reel/"],
    html.rb-hide-reels [role="article"]:has(a[href*="/reel/"]),
    html.rb-hide-reels [data-pagelet^="FeedUnit"]:has(a[href*="/reel/"]),
    html.rb-hide-reels [aria-label="Reels"],
    html.rb-hide-reels [aria-label="Reels and short videos"] { display: none !important; }

    .rb-hidden { display: none !important; }

    #rb-toast {
      position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%);
      z-index: 2147483647; max-width: 86vw; padding: 10px 16px; border-radius: 20px;
      background: rgba(20, 20, 20, 0.92); color: #fff; text-align: center;
      font: 600 14px/1.35 -apple-system, BlinkMacSystemFont, sans-serif;
      pointer-events: none; transition: opacity .3s;
    }
  `;

  function injectStyle() {
    const style = document.createElement('style');
    style.id = 'rb-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function toast(message) {
    const show = () => {
      let el = document.getElementById('rb-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'rb-toast';
        document.body.appendChild(el);
      }
      el.textContent = message;
      el.style.opacity = '1';
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => { el.style.opacity = '0'; }, 2500);
    };
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show, { once: true });
  }

  function block(decision) {
    store.set('toast', decision.message);
    location.replace(decision.to || store.get('lastNonReel') || '/');
  }

  function setPageClasses(type) {
    const root = document.documentElement;
    if (!root) return;
    root.classList.toggle('rb-hide-reels', type !== 'messages' && type !== 'reel');
    root.classList.toggle('rb-block-watch', SETTINGS.blockWatchFeed);
  }

  function currentType() {
    return classifyPath(location.pathname, location.search).type;
  }

  let prevPath = null;
  let lastHref = null;

  function onUrl() {
    if (location.href === lastHref) return;
    lastHref = location.href;
    const path = location.pathname;
    const type = classifyPath(path, location.search).type;

    const decision = decideNavigation(prevPath, path, location.search, store.get('allowedReel'), SETTINGS);
    if (decision.action === 'block') return block(decision);
    if (decision.remember) store.set('allowedReel', decision.remember);

    if (SETTINGS.friendsFeedByDefault) {
      const target = friendsFeedUrl(path, location.search);
      const last = Number(store.get('friendsRedirectAt') || 0);
      // Time guard: if Facebook strips the parameters, don't reload forever.
      if (target && Date.now() - last > 10000) {
        store.set('friendsRedirectAt', String(Date.now()));
        location.replace(target);
        return;
      }
    }

    if (type !== 'reel') store.set('lastNonReel', location.href);
    setPageClasses(type);
    prevPath = path;
    scheduleSweep();
  }

  const REELS_HEADING = /^(Reels|Reels and short videos|Short videos)$/i;

  // The mobile site (m.facebook.com) uses few links or labels, so also look for
  // feed sections titled "Reels" and hide the whole section.
  function hideReelsShelves() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (REELS_HEADING.test(n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const hits = [];
    while (walker.nextNode()) hits.push(walker.currentNode.parentElement);
    hits.forEach((heading) => {
      if (!heading || heading.closest('.rb-hidden, a, nav, [role="navigation"], [role="tablist"], [role="tab"], [role="banner"]')) return;
      const shelf = findSection(heading);
      if (shelf) shelf.classList.add('rb-hidden');
    });
  }

  // Climb to the ancestor that is one item in a list of siblings (a feed unit),
  // and only accept it if it looks like a thumbnail shelf of sensible size.
  function findSection(el) {
    for (let i = 0; i < 14 && el && el.parentElement && el.parentElement !== document.body; i++) {
      const parent = el.parentElement;
      if (parent.children.length >= 3) {
        const h = el.offsetHeight;
        const media = el.querySelectorAll('img, video').length;
        const ok = h > 80 && h < window.innerHeight * 1.5 && media >= 2 &&
          !el.querySelector('nav, [role="navigation"], [role="feed"], [role="main"]');
        return ok ? el : null;
      }
      el = parent;
    }
    return null;
  }

  function sweep() {
    const cur = classifyPath(location.pathname, location.search);
    // The site sometimes rewrites <html class>, so re-apply ours.
    setPageClasses(cur.type);
    if (cur.type === 'reel') {
      // Hide links to *other* reels on a reel page.
      document.querySelectorAll('a[href*="/reel/"]').forEach((a) => {
        if (!a.getAttribute('href').includes('/' + cur.id)) a.classList.add('rb-hidden');
      });
    } else if (cur.type !== 'messages' && document.body) {
      hideReelsShelves();
    }
  }

  let sweepTimer = null;
  function scheduleSweep() {
    if (sweepTimer) return;
    sweepTimer = setTimeout(() => { sweepTimer = null; sweep(); }, 200);
  }

  // Backstop for scrolling that doesn't change the URL: on a reel page, if a
  // container holding several videos scrolls past the first one, snap it back.
  function onScroll(e) {
    if (currentType() !== 'reel') return;
    const el = e.target === document ? document.scrollingElement : e.target;
    if (!el || !el.querySelectorAll || el.querySelectorAll('video').length < 2) return;
    if (el.scrollTop > window.innerHeight * 0.6) {
      el.scrollTop = 0;
      toast('One reel only');
    }
  }

  // At document start <html> may not exist yet; wait for it before touching the DOM.
  function whenRoot(fn) {
    if (document.documentElement) return fn();
    const mo = new MutationObserver(() => {
      if (document.documentElement) { mo.disconnect(); fn(); }
    });
    mo.observe(document, { childList: true });
  }

  onUrl();
  whenRoot(() => {
    injectStyle();
    setPageClasses(currentType());
    new MutationObserver(scheduleSweep).observe(document.documentElement, { childList: true, subtree: true });
  });
  const pending = store.get('toast');
  if (pending) {
    store.set('toast', '');
    toast(pending);
  }
  setInterval(onUrl, 200);
  window.addEventListener('popstate', onUrl);
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
})();
