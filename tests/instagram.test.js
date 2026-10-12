const test = require('node:test');
const assert = require('node:assert');
const { classifyPath, decideNavigation, followingFeedUrl } = require('../ios/ReelsBlocker/Scripts/instagram.user.js');

const strict = { reelsOnlyFromMessages: true };
const loose = { reelsOnlyFromMessages: false };

test('classifies Instagram paths', () => {
  assert.deepStrictEqual(classifyPath('/reels/'), { type: 'reelsFeed' });
  assert.deepStrictEqual(classifyPath('/reel/Cabc_1-2/'), { type: 'reel', id: 'Cabc_1-2' });
  assert.deepStrictEqual(classifyPath('/reels/Cabc/'), { type: 'reel', id: 'Cabc' });
  assert.deepStrictEqual(classifyPath('/someone/reels/'), { type: 'profileReels', user: 'someone' });
  assert.strictEqual(classifyPath('/direct/t/123/').type, 'messages');
  assert.strictEqual(classifyPath('/direct/inbox/').type, 'messages');
  assert.strictEqual(classifyPath('/explore/').type, 'explore');
  assert.strictEqual(classifyPath('/').type, 'home');
  assert.strictEqual(classifyPath('/p/Cxyz/').type, 'other');
  assert.strictEqual(classifyPath('/someone/').type, 'other');
});

test('a reel tapped in DMs opens', () => {
  const d = decideNavigation('/direct/t/123/', '/reel/A/', null, strict);
  assert.deepStrictEqual(d, { action: 'allow', remember: 'A' });
});

test('scrolling to the next reel is blocked and returns to the last page', () => {
  const d = decideNavigation('/reel/A/', '/reel/B/', 'A', strict);
  assert.strictEqual(d.action, 'block');
  assert.strictEqual(d.to, null);
});

test('URL canonicalisation of the same reel is fine', () => {
  assert.strictEqual(decideNavigation('/reel/A/', '/reels/A/', 'A', strict).action, 'allow');
});

test('reels feed and profile reels tab are always blocked', () => {
  assert.strictEqual(decideNavigation('/', '/reels/', null, loose).action, 'block');
  assert.strictEqual(decideNavigation(null, '/reels/', null, loose).action, 'block');
  const d = decideNavigation('/bob/', '/bob/reels/', null, loose);
  assert.deepStrictEqual([d.action, d.to], ['block', '/bob/']);
});

test('a reel link opened from another app (fresh load) opens', () => {
  assert.deepStrictEqual(decideNavigation(null, '/reel/X/', 'A', strict), { action: 'allow', remember: 'X' });
});

test('strict mode blocks reels opened outside DMs; loose mode allows them', () => {
  const d = decideNavigation('/bob/', '/reel/A/', null, strict);
  assert.deepStrictEqual([d.action, d.to], ['block', '/bob/']);
  assert.strictEqual(decideNavigation('/bob/', '/reel/A/', null, loose).action, 'allow');
});

test('going back to DMs and tapping another reel works', () => {
  assert.strictEqual(decideNavigation('/reel/A/', '/direct/t/1/', 'A', strict).action, 'allow');
  assert.deepStrictEqual(decideNavigation('/direct/t/1/', '/reel/B/', 'A', strict), { action: 'allow', remember: 'B' });
});

test('home goes to the Following feed', () => {
  assert.strictEqual(followingFeedUrl('/', ''), '/?variant=following');
  assert.strictEqual(followingFeedUrl('/', '?variant=following'), null);
  assert.strictEqual(followingFeedUrl('/direct/inbox/', ''), null);
});
