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
  // Performance notes: DOM work only touches nodes as they are added (inside the
  // MutationObserver callback, so before they are painted), never rescans the
  // page, never reads layout, and hiding is done with plain class selectors
  // (no :has()). URL changes are pushed by the app (WKWebView `url` KVO), with
  // a slow poll as a safety net.

  const KEY = 'reelsBlocker:';
  const store = {
    get(k) { try { return sessionStorage.getItem(KEY + k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(KEY + k, v); } catch (e) { /* ignore */ } },
  };

  const REEL_LINK = 'a[href*="/reel/"]';
  const FEED_UNIT = '[role="article"], [data-pagelet^="FeedUnit"]';
  const REELS_WORD = /Reels|Short videos/i;
  const REELS_HEADING = /^\s*(Reels|Reels and short videos|Short videos)\s*$/i;
  const NOT_A_SHELF = '.rb-reel-shelf, nav, [role="navigation"], [role="tablist"], [role="banner"]';

  const CSS = `
    a[href="/reel/"], a[href^="/reel/?"], a[href="/reels/"], a[href$="/reels/"],
    a[href*="sk=reels_tab"] { display: none !important; }
    html.rb-block-watch a[href="/watch/"], html.rb-block-watch a[href^="/watch/?"]:not([href*="v="]),
    html.rb-block-watch a[href="/watch"] { display: none !important; }
    html.rb-hide-reels ${REEL_LINK},
    html.rb-hide-reels .rb-reel-post,
    html.rb-hide-reels .rb-reel-shelf,
    html.rb-hide-reels [aria-label="Reels"],
    html.rb-hide-reels [aria-label="Reels and short videos"] { display: none !important; }
    #rb-toast {
      position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%);
      z-index: 2147483647; max-width: 86vw; padding: 10px 16px; border-radius: 20px;
      background: rgba(20, 20, 20, 0.92); color: #fff; text-align: center;
      font: 600 14px/1.35 -apple-system, BlinkMacSystemFont, sans-serif;
      pointer-events: none; transition: opacity .3s;
    }
  `;

  const SHELF_MAX_TEXT = 1500;

  let pageType = null;
  let reelId = null;
  let shelves = 0; // how many sections are marked, so the growth check costs nothing until then
  let reelStyle = null; // on a reel page: hides links to every *other* reel

  function applyPage() {
    const root = document.documentElement;
    if (!root || !reelStyle) return;
    const hide = pageType !== 'messages' && pageType !== 'reel';
    const watch = SETTINGS.blockWatchFeed;
    if (root.classList.contains('rb-hide-reels') !== hide) root.classList.toggle('rb-hide-reels', hide);
    if (root.classList.contains('rb-block-watch') !== watch) root.classList.toggle('rb-block-watch', watch);
    const css = pageType === 'reel'
      ? `${REEL_LINK}:not([href*="/${reelId}"]) { display: none !important; }` : '';
    if (reelStyle.textContent !== css) reelStyle.textContent = css;
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

  let prevPath = null;
  let lastHref = null;

  function onUrl() {
    const href = location.href;
    if (href === lastHref) return;
    lastHref = href;
    const path = location.pathname;
    const page = classifyPath(path, location.search);

    const decision = decideNavigation(prevPath, path, location.search, store.get('allowedReel'), SETTINGS);
    if (decision.action === 'block') return block(decision);
    if (decision.remember) store.set('allowedReel', decision.remember);

    // Only on a fresh page load: redirecting later would cost a full reload.
    if (prevPath === null && SETTINGS.friendsFeedByDefault) {
      const target = friendsFeedUrl(path, location.search);
      const last = Number(store.get('friendsRedirectAt') || 0);
      // Time guard: if Facebook strips the parameters, don't reload forever.
      if (target && Date.now() - last > 10000) {
        store.set('friendsRedirectAt', String(Date.now()));
        location.replace(target);
        return;
      }
    }

    if (page.type !== 'reel') store.set('lastNonReel', href);
    pageType = page.type;
    reelId = page.id || null;
    applyPage();
    prevPath = path;
  }

  function markReelLink(a) {
    const post = a.closest(FEED_UNIT);
    if (post) post.classList.add('rb-reel-post');
  }

  // The mobile site (m.facebook.com) has few links or labels, so also find feed
  // sections titled "Reels": climb from the title to the ancestor that is one
  // item in a list (a feed unit) and mark it, if it's small enough to be a shelf.
  function markShelf(heading) {
    if (!heading || heading.closest(NOT_A_SHELF)) return;
    let el = heading;
    for (let i = 0; i < 14 && el.parentElement && el.parentElement !== document.body; i++) {
      if (el.parentElement.childElementCount >= 3) {
        if (el.textContent.length < SHELF_MAX_TEXT && !el.querySelector('nav, [role="navigation"], [role="feed"], [role="main"]')) {
          el.classList.add('rb-reel-shelf');
          shelves++;
        }
        return;
      }
      el = el.parentElement;
    }
  }

  function scanText(root) {
    if (!REELS_WORD.test(root.textContent)) return; // fast path: nearly always
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (REELS_HEADING.test(n.nodeValue)) markShelf(n.parentElement);
    }
  }

  function scan(el) {
    if (el.matches(REEL_LINK)) markReelLink(el);
    if (el.firstElementChild) {
      const links = el.querySelectorAll(REEL_LINK);
      for (let i = 0; i < links.length; i++) markReelLink(links[i]);
    }
    scanText(el);
  }

  function onMutations(records) {
    for (let r = 0; r < records.length; r++) {
      const record = records[r];
      if (record.type === 'attributes') {
        if (record.target.matches(REEL_LINK)) markReelLink(record.target);
        continue;
      }
      const added = record.addedNodes;
      if (shelves && added.length) {
        // A title can arrive before the rest of the page; if what we marked grows
        // into something big (e.g. the whole feed), it wasn't a Reels section.
        const shelf = record.target.closest && record.target.closest('.rb-reel-shelf');
        if (shelf && shelf.textContent.length >= SHELF_MAX_TEXT) {
          shelf.classList.remove('rb-reel-shelf');
          shelves--;
        }
      }
      for (let i = 0; i < added.length; i++) {
        const node = added[i];
        if (node.nodeType === 1) scan(node);
        else if (node.nodeType === 3 && REELS_HEADING.test(node.nodeValue)) markShelf(node.parentElement);
      }
    }
  }

  // Backstop for scrolling that doesn't change the URL: on a reel page, if a
  // container holding several videos scrolls past the first one, snap it back.
  function onScroll(e) {
    if (pageType !== 'reel') return;
    const el = e.target === document ? document.scrollingElement : e.target;
    if (!el || !el.getElementsByTagName || el.getElementsByTagName('video').length < 2) return;
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

  window.__reelsBlockerCheck = onUrl; // called by the app on every URL change
  onUrl();
  whenRoot(() => {
    const root = document.documentElement;
    const style = document.createElement('style');
    style.textContent = CSS;
    reelStyle = document.createElement('style');
    (document.head || root).append(style, reelStyle);
    applyPage();
    scan(root);
    new MutationObserver(onMutations).observe(root, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['href'],
    });
    // The site sometimes rewrites <html class>; put ours back.
    new MutationObserver(applyPage).observe(root, { attributes: true, attributeFilter: ['class'] });
  });
  const pending = store.get('toast');
  if (pending) {
    store.set('toast', '');
    toast(pending);
  }
  setInterval(onUrl, 1000);
  window.addEventListener('popstate', onUrl);
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
})();
