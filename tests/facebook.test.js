const test = require('node:test');
const assert = require('node:assert');
const { classifyPath, decideNavigation, friendsFeedUrl } = require('../ios/ReelsBlocker/Scripts/facebook.user.js');

const settings = { reelsOnlyFromMessages: true, blockWatchFeed: true };

test('classifies Facebook paths', () => {
  assert.strictEqual(classifyPath('/reel/').type, 'reelsFeed');
  assert.deepStrictEqual(classifyPath('/reel/123456789/'), { type: 'reel', id: '123456789' });
  assert.strictEqual(classifyPath('/watch/').type, 'watchFeed');
  assert.strictEqual(classifyPath('/watch/', '?v=42').type, 'video');
  assert.strictEqual(classifyPath('/bob/reels/').type, 'profileReels');
  assert.strictEqual(classifyPath('/profile.php', '?id=1&sk=reels_tab').type, 'profileReels');
  assert.strictEqual(classifyPath('/messages/t/1').type, 'messages');
  assert.strictEqual(classifyPath('/home.php').type, 'home');
});

test('shared reel from another app opens; swiping to the next is blocked', () => {
  assert.deepStrictEqual(decideNavigation(null, '/reel/1/', '', null, settings), { action: 'allow', remember: '1' });
  assert.strictEqual(decideNavigation('/reel/1/', '/reel/2/', '', '1', settings).action, 'block');
});

test('reel from Messages opens, from feed is blocked', () => {
  assert.strictEqual(decideNavigation('/messages/t/9', '/reel/1/', '', null, settings).action, 'allow');
  assert.strictEqual(decideNavigation('/', '/reel/1/', '', null, settings).action, 'block');
});

test('reels feed and video feed are blocked, single videos are not', () => {
  assert.strictEqual(decideNavigation('/', '/reel/', '', null, settings).action, 'block');
  assert.strictEqual(decideNavigation('/', '/watch/', '', null, settings).action, 'block');
  assert.strictEqual(decideNavigation('/', '/watch/', '?v=5', null, settings).action, 'allow');
  assert.strictEqual(decideNavigation('/', '/watch/', '', null, { ...settings, blockWatchFeed: false }).action, 'allow');
});

test('home goes to the Friends feed', () => {
  assert.strictEqual(friendsFeedUrl('/', ''), '/?filter=friends&sk=h_chr');
  assert.strictEqual(friendsFeedUrl('/home.php', ''), '/?filter=friends&sk=h_chr');
  assert.strictEqual(friendsFeedUrl('/', '?filter=friends&sk=h_chr'), null);
  assert.strictEqual(friendsFeedUrl('/bob', ''), null);
});
