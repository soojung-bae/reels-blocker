// ==UserScript==
// @name         Reels Blocker – Instagram
// @namespace    reels-blocker
// @version      1.0.0
// @description  Blocks Instagram Reels. A reel someone sends you still opens, but only that one reel – no scrolling on to the next.
// @match        *://*.instagram.com/*
// @run-at       document-start
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ---- Settings (edit these) ----------------------------------------------
  const SETTINGS = {
    // true: a single reel only opens when you tap it in your DMs, or when you
    //       open an instagram.com/reel/... link from another app.
    // false: a single reel may also be opened from profiles, posts, etc.
    reelsOnlyFromMessages: true,
    // Open the "Following" feed (only accounts you follow, newest first)
    // instead of the algorithmic home feed.
    followingFeedByDefault: true,
    // Hide "Suggested for you" and "Sponsored" posts in the feed.
    hideSuggestedPosts: true,
    // Hide the post grid on the Explore page (search still works).
    hideExploreGrid: true,
  };

  // ---- Pure logic (unit tested in tests/) -----------------------------------

  function classifyPath(path) {
    if (/^\/reels?\/?$/.test(path)) return { type: 'reelsFeed' };
    const reel = path.match(/^\/reels?\/([A-Za-z0-9_-]+)\/?$/);
    if (reel) return { type: 'reel', id: reel[1] };
    const profileReels = path.match(/^\/([^/]+)\/reels\/?$/);
    if (profileReels) return { type: 'profileReels', user: profileReels[1] };
    if (path.startsWith('/direct/')) return { type: 'messages' };
    if (/^\/explore\/?$/.test(path)) return { type: 'explore' };
    if (path === '/') return { type: 'home' };
    return { type: 'other' };
  }

  // prevPath is null on a fresh page load (link from another app, reload).
  // Returns { action: 'allow', remember? } or { action: 'block', message, to }
  // where `to` null means "go back to the last non-reel page".
  function decideNavigation(prevPath, curPath, allowedReelId, settings) {
    const cur = classifyPath(curPath);
    if (cur.type === 'reelsFeed') {
      return { action: 'block', message: 'Reels are blocked', to: null };
    }
    if (cur.type === 'profileReels') {
      return { action: 'block', message: 'Reels are blocked', to: '/' + cur.user + '/' };
    }
    if (cur.type !== 'reel') return { action: 'allow' };
    if (cur.id === allowedReelId) return { action: 'allow' };
    if (prevPath === null) return { action: 'allow', remember: cur.id };

    const prev = classifyPath(prevPath);
    if (prev.type === 'reel') {
      // Moving from one reel straight to another = scrolling the reels feed.
      return { action: 'block', message: 'One reel only – you’re back where you were', to: null };
    }
    if (settings.reelsOnlyFromMessages && prev.type !== 'messages') {
      return { action: 'block', message: 'Reels only open from your messages', to: prevPath };
    }
    return { action: 'allow', remember: cur.id };
  }

  function followingFeedUrl(path, search) {
    if (path !== '/' || /[?&]variant=/.test(search)) return null;
    return '/?variant=following';
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { classifyPath, decideNavigation, followingFeedUrl };
    return;
  }

  // ---- Browser runtime ---------------------------------------------------------
  // Performance notes: DOM work only touches nodes as they are added (inside the
  // MutationObserver callback, so before they are painted), never rescans the
  // page, never reads layout, and hiding is done with plain class selectors
  // (no :has()). URL changes are pushed by the app (WKWebView `url` KVO) or
  // come from the Navigation API where available, with polling as a backup.

  const KEY = 'reelsBlocker:';
  const store = {
    get(k) { try { return sessionStorage.getItem(KEY + k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(KEY + k, v); } catch (e) { /* ignore */ } },
  };

  const SUGGESTED = /Suggested for you|Suggested posts|Sponsored/;
  const REEL_LINK = 'a[href*="/reel/"]';

  const CSS = `
    a[href="/reels/"], a[href^="/reels/?"], a[href$="/reels/"] { display: none !important; }
    html.rb-hide-reels ${REEL_LINK}, html.rb-hide-reels .rb-reel-post { display: none !important; }
    html.rb-explore-grid main a[href^="/p/"] { display: none !important; }
    .rb-suggested { display: none !important; }
    #rb-toast {
      position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%);
      z-index: 2147483647; max-width: 86vw; padding: 10px 16px; border-radius: 20px;
      background: rgba(20, 20, 20, 0.92); color: #fff; text-align: center;
      font: 600 14px/1.35 -apple-system, BlinkMacSystemFont, sans-serif;
      pointer-events: none; transition: opacity .3s;
    }
  `;

  let pageType = null;
  let reelId = null;
  let reelStyle = null; // on a reel page: hides links to every *other* reel

  function applyPage() {
    const root = document.documentElement;
    if (!root || !reelStyle) return;
    const hide = pageType !== 'messages' && pageType !== 'reel';
    const explore = SETTINGS.hideExploreGrid && pageType === 'explore';
    if (root.classList.contains('rb-hide-reels') !== hide) root.classList.toggle('rb-hide-reels', hide);
    if (root.classList.contains('rb-explore-grid') !== explore) root.classList.toggle('rb-explore-grid', explore);
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
    location.replace(decision.to || store.get('lastNonReel') || '/direct/inbox/');
  }

  let prevPath = null;
  let lastHref = null;

  function onUrl() {
    const href = location.href;
    if (href === lastHref) return;
    lastHref = href;
    const path = location.pathname;
    const page = classifyPath(path);

    const decision = decideNavigation(prevPath, path, store.get('allowedReel'), SETTINGS);
    if (decision.action === 'block') return block(decision);
    if (decision.remember) store.set('allowedReel', decision.remember);

    // Only on a fresh page load: redirecting later would cost a full reload.
    if (prevPath === null && SETTINGS.followingFeedByDefault) {
      const target = followingFeedUrl(path, location.search);
      const last = Number(store.get('followingRedirectAt') || 0);
      // Time guard: if Instagram strips the parameter, don't reload forever.
      if (target && Date.now() - last > 10000) {
        store.set('followingRedirectAt', String(Date.now()));
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
    const post = a.closest('article');
    if (post) post.classList.add('rb-reel-post');
  }

  function checkSuggested(el, text) {
    if (!SETTINGS.hideSuggestedPosts || !SUGGESTED.test(text)) return;
    const post = el.closest('article');
    if (post) post.classList.add('rb-suggested');
  }

  function scan(el) {
    if (el.matches(REEL_LINK)) markReelLink(el);
    if (el.firstElementChild) {
      const links = el.querySelectorAll(REEL_LINK);
      for (let i = 0; i < links.length; i++) markReelLink(links[i]);
    }
    if (!SETTINGS.hideSuggestedPosts) return;
    if (el.closest('article')) {
      checkSuggested(el, el.textContent);
    } else {
      const posts = el.getElementsByTagName('article');
      for (let i = 0; i < posts.length; i++) checkSuggested(posts[i], posts[i].textContent);
    }
  }

  function onMutations(records) {
    for (let r = 0; r < records.length; r++) {
      const record = records[r];
      if (record.type === 'attributes') {
        if (record.target.matches(REEL_LINK)) markReelLink(record.target);
        continue;
      }
      const added = record.addedNodes;
      for (let i = 0; i < added.length; i++) {
        const node = added[i];
        if (node.nodeType === 1) scan(node);
        else if (node.nodeType === 3 && node.parentElement) checkSuggested(node.parentElement, node.nodeValue);
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
  // In the app, URL changes are pushed instantly, so polling is only a safety
  // net. In Safari (Userscripts) there is no push, so poll faster.
  setInterval(onUrl, window.__reelsBlockerNative ? 1000 : 250);
  window.addEventListener('popstate', onUrl);
  if (window.navigation) window.navigation.addEventListener('currententrychange', onUrl);
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
})();
