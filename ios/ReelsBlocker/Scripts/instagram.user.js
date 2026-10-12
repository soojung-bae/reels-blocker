// ==UserScript==
// @name         Reels Blocker – Instagram
// @namespace    reels-blocker
// @version      1.0.0
// @description  Blocks Instagram Reels. A reel someone sends you still opens, but only that one reel – no scrolling on to the next.
// @match        *://*.instagram.com/*
// @run-at       document-start
// @inject-into  content
// @grant        none
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

  const KEY = 'reelsBlocker:';
  const store = {
    get(k) { try { return sessionStorage.getItem(KEY + k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(KEY + k, v); } catch (e) { /* ignore */ } },
  };

  const CSS = `
    /* Reels tab (bottom bar / sidebar) and the Reels tab on profiles */
    a[href="/reels/"], a[href^="/reels/?"], a[href$="/reels/"] { display: none !important; }

    /* Reels in the feed, on profiles and on Explore. Not in DMs, so a reel
       someone sent you stays tappable. */
    html.rb-hide-reels a[href*="/reel/"],
    html.rb-hide-reels article:has(a[href*="/reel/"]) { display: none !important; }

    html.rb-explore-grid main a[href^="/p/"] { display: none !important; }

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
    location.replace(decision.to || store.get('lastNonReel') || '/direct/inbox/');
  }

  function setPageClasses(type) {
    const root = document.documentElement;
    if (!root) return;
    root.classList.toggle('rb-hide-reels', type !== 'messages' && type !== 'reel');
    root.classList.toggle('rb-explore-grid', SETTINGS.hideExploreGrid && type === 'explore');
  }

  function currentType() {
    return classifyPath(location.pathname).type;
  }

  let prevPath = null;
  let lastHref = null;

  function onUrl() {
    if (location.href === lastHref) return;
    lastHref = location.href;
    const path = location.pathname;
    const type = classifyPath(path).type;

    const decision = decideNavigation(prevPath, path, store.get('allowedReel'), SETTINGS);
    if (decision.action === 'block') return block(decision);
    if (decision.remember) store.set('allowedReel', decision.remember);

    if (SETTINGS.followingFeedByDefault) {
      const target = followingFeedUrl(path, location.search);
      const last = Number(store.get('followingRedirectAt') || 0);
      // Time guard: if Instagram strips the parameter, don't reload forever.
      if (target && Date.now() - last > 10000) {
        store.set('followingRedirectAt', String(Date.now()));
        location.replace(target);
        return;
      }
    }

    if (type !== 'reel') store.set('lastNonReel', location.href);
    setPageClasses(type);
    prevPath = path;
    scheduleSweep();
  }

  // Things CSS can't express: hide links to *other* reels on a reel page
  // ("more reels" suggestions) and hide suggested/sponsored posts.
  function sweep() {
    const cur = classifyPath(location.pathname);
    // The site sometimes rewrites <html class>, so re-apply ours.
    setPageClasses(cur.type);
    if (cur.type === 'reel') {
      document.querySelectorAll('a[href*="/reel/"]').forEach((a) => {
        if (!a.getAttribute('href').includes('/' + cur.id)) a.classList.add('rb-hidden');
      });
    }
    if (SETTINGS.hideSuggestedPosts) {
      document.querySelectorAll('article:not([data-rb-checked])').forEach((article) => {
        article.setAttribute('data-rb-checked', '');
        const text = article.innerText || '';
        if (/Suggested for you|Sponsored|Suggested posts/.test(text.slice(0, 400))) {
          article.classList.add('rb-hidden');
        }
      });
    }
  }

  let sweepTimer = null;
  function scheduleSweep() {
    if (sweepTimer) return;
    sweepTimer = setTimeout(() => { sweepTimer = null; sweep(); }, 150);
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
