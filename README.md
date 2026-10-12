# Reels Blocker

An iPhone app for Instagram and Facebook without Reels.

- **Instagram:** the Reels tab and Reels in your feed are gone. A reel someone sends you in DMs still plays when you tap it, but only that one: swiping to the next reel sends you back to the chat.
- **Facebook:** the Reels tab, Reels shelves in the feed and the Video feed are gone. A single reel link still opens; swiping on is blocked.
- **Friends first:** Instagram opens on the *Following* feed (people you follow, newest first) and Facebook on the *Friends* feed. "Suggested for you" and "Sponsored" posts are hidden.

## How it works (and why your account is safe)

iOS doesn't let any app change what happens inside the real Instagram or Facebook app. App Store blockers like ScrollGuard, UNDOOMED and Sociano all work around that the same way, and so does this app:

1. **It shows the official mobile websites** (`instagram.com`, `m.facebook.com`) inside the app and injects a small script (`ios/ReelsBlocker/Scripts/`) that removes Reels before you see them.
2. **A Shortcuts automation sends you here** whenever you open the real Instagram or Facebook app, so you don't have to remember to use it.

You log in to Meta's own website, just as you would in Safari. Nothing is modified or sideloaded into Instagram, so there's nothing for Meta to flag. That's the difference from modded apps like SCInsta, which do risk your account.

## Install (Mac + Xcode, about 15 minutes)

1. Install **Xcode** from the Mac App Store and open it once.
2. Get this repo onto the Mac: `git clone https://github.com/soojung-bae/reels-blocker`, or use GitHub Desktop.
3. Open `ios/ReelsBlocker.xcodeproj`.
4. Click the **ReelsBlocker** project → **Signing & Capabilities**:
   - **Team:** choose your Apple ID (Xcode → Settings → Accounts → "+" if it's not listed).
   - **Bundle Identifier:** change `com.example.reelsblocker` to something unique, e.g. `com.yourname.reelsblocker`.
5. Plug in your iPhone and pick it as the run destination at the top of the window.
6. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode** (the phone restarts).
7. Press **▶ Run** in Xcode. The first time, the iPhone asks you to trust the developer: **Settings → General → VPN & Device Management → your Apple ID → Trust**.
8. Open Reels Blocker and log in to Instagram and Facebook. You stay logged in.

> **Free Apple ID vs paid:** with a free Apple ID, apps you install yourself stop opening after **7 days**. Plug the phone in and press Run again; your logins are kept. A paid Apple Developer account ($99/year) makes each install last a year.

## Make it the default

Do this once for Instagram and once for Facebook:

1. Open **Shortcuts → Automation → New Automation** (the **+**).
2. Choose **App** → pick **Instagram** → tick **Is Opened** → select **Run Immediately** → **Next**.
3. **New Blank Automation** → add the action **Open URLs** → type `reelsblocker://instagram` → **Done**.
4. Repeat with **Facebook** and `reelsblocker://facebook`.

Now tapping Instagram, Facebook or one of their notifications jumps straight into Reels Blocker.

Then tidy up the Home Screen: long-press the Instagram and Facebook icons → **Remove from Home Screen** (not *Delete App*), and put Reels Blocker in their place. Keep the real apps installed so you still get notifications.

## Watching a reel someone sent you

- **Instagram DMs:** open your messages in Reels Blocker and tap the reel. It plays. Swipe and you're back in the chat with a "One reel only" note.
- **Messenger / iMessage / anywhere else:** long-press the reel → **Copy link**, open Reels Blocker, and tap the **Paste** button at the top. Only that reel opens.
- Optional share-sheet shortcut: make a shortcut that *receives URLs from the Share Sheet* and runs **Open URLs** with `reelsblocker://open?url=` followed by the **URL Encode**d input. Then **Share → Watch in Reels Blocker** works from any app.

## Settings

Each script has a `SETTINGS` block at the top. Edit it and press Run in Xcode again.

| Setting | Default | What it does |
|---|---|---|
| `reelsOnlyFromMessages` | `true` | Single reels open only from DMs or a pasted/shared link. Set `false` to also allow them from profiles. |
| `followingFeedByDefault` (IG) / `friendsFeedByDefault` (FB) | `true` | Open the Following / Friends feed instead of the algorithmic one. The app's start page and Home button already go there; change `home` in `ios/ReelsBlocker/Site.swift` too if you turn this off. |
| `hideSuggestedPosts` (IG) | `true` | Hide "Suggested for you" and "Sponsored" posts. |
| `hideExploreGrid` (IG) | `true` | Hide the post grid on Explore; search still works. |
| `blockWatchFeed` (FB) | `true` | Block the Video feed; single shared videos still open. |

Files: `ios/ReelsBlocker/Scripts/instagram.user.js` and `facebook.user.js`.

## Limitations

- These are the mobile **websites**, so a few app-only features are missing (Instagram web can't post Stories; Facebook messages open in the Messenger app).
- Meta changes its web pages often. The blocking mostly keys off URLs (`/reel/…`, `/reels/`), which rarely change. Hiding things in the feed relies on page structure and English labels ("Suggested for you", "Reels"), so it may need an occasional tweak.
- The Following/Friends feed links (`?variant=following`, `?filter=friends&sk=h_chr`) are unofficial. If Meta drops them, the normal feed shows, still without Reels.

## Development

```sh
npm test   # unit tests for the blocking rules (Node 18+)
```

CI (`.github/workflows/ci.yml`) runs those tests and builds the app for the iOS Simulator on every push.
