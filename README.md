# Reels Blocker

Instagram and Facebook on iPhone without Reels, as its own app or in Safari.

- **Instagram:** the Reels tab and Reels in your feed are gone. A reel someone sends you in DMs still plays when you tap it, but only that one: swiping to the next reel sends you back to the chat.
- **Facebook:** the Reels tab, Reels shelves in the feed and the Video feed are gone. A single reel link still opens; swiping on is blocked.
- **Friends first:** Instagram opens on the *Following* feed (people you follow, newest first) and Facebook on the *Friends* feed. "Suggested for you" and "Sponsored" posts are hidden.

## How it works (and why your account is safe)

iOS doesn't let any app change what happens inside the real Instagram or Facebook app. App Store blockers like ScrollGuard, UNDOOMED and Sociano all work around that the same way, and so does this app:

1. **It shows the official mobile websites** (`instagram.com`, `m.facebook.com`) inside the app and injects a small script (`ios/ReelsBlocker/Scripts/`) that removes Reels before you see them.
2. **A Shortcuts automation sends you here** whenever you open the real Instagram or Facebook app, so you don't have to remember to use it.

The same scripts also run in Safari through the free Userscripts app, which needs no computer at all (option A below).

You log in to Meta's own website, just as you would in Safari. Nothing is modified or sideloaded into Instagram, so there's nothing for Meta to flag. That's the difference from modded apps like SCInsta, which do risk your account.

## Install: pick one

| | Needs | Feels like | Upkeep |
|---|---|---|---|
| **A. Safari** | Just the iPhone | Instagram/Facebook in Safari tabs | None |
| **B. The app, via AltStore** | A Mac once (small download, no Xcode) | Its own app with an Instagram/Facebook switcher | Re-signs every 7 days, automatically on the same Wi-Fi as the Mac |
| **C. The app, via Xcode** | A Mac with ~40 GB free for Xcode | Same as B | Press Run again every 7 days |

All three use the same blocking scripts, and with the automation below all three open automatically when you tap Instagram or Facebook.

### A. Safari (no computer)

1. Install **Userscripts** (free, by Justin Wasack) from the App Store and open it once. When asked, choose a folder for scripts, e.g. *On My iPhone → Userscripts*.
2. **Settings → Apps → Safari → Extensions → Userscripts:** turn it on and set **instagram.com** and **facebook.com** to **Allow** (or *All Websites*).
3. Install the two scripts. In Safari, open each link, tap the **aA** button → **Userscripts** → **Install**:
   - [instagram.user.js](https://raw.githubusercontent.com/soojung-bae/reels-blocker/claude/reel-blocker-app-pwwkxr/ios/ReelsBlocker/Scripts/instagram.user.js)
   - [facebook.user.js](https://raw.githubusercontent.com/soojung-bae/reels-blocker/claude/reel-blocker-app-pwwkxr/ios/ReelsBlocker/Scripts/facebook.user.js)

   If the repo is private, log in to github.com in Safari first, open the file on GitHub and tap **Raw**.
4. Log in at instagram.com and m.facebook.com in Safari.
5. Set up the automations below with the **Safari** links.

Don't use *Add to Home Screen* for Instagram/Facebook: Safari extensions don't run in Home Screen web apps. A Safari bookmark or Favorite is fine.

### B. The app, without Xcode (AltStore)

Every push builds an installable `ReelsBlocker.ipa` and attaches it to the [**Latest build** release](https://github.com/soojung-bae/reels-blocker/releases/tag/latest).

1. On the Mac, install **AltServer** from [altstore.io](https://altstore.io) and follow its guide to put **AltStore** on your iPhone. You plug the phone in once.
2. On the iPhone, open the **Latest build** release in Safari and download **ReelsBlocker.ipa**. If the repo is private, log in to github.com first.
3. Open the downloaded file and share it to **AltStore**, or in AltStore go to **My Apps → +** and pick the file. AltStore signs it with your Apple ID.
4. If iOS asks, turn on **Settings → Privacy & Security → Developer Mode** (the phone restarts).
5. Open Reels Blocker and log in to Instagram and Facebook.
6. Set up the automations below with the **app** links.

A free Apple ID makes sideloaded apps expire after **7 days**. AltStore renews them in the background while the Mac with AltServer is on the same Wi-Fi, or tap **Refresh All** in AltStore. [Sideloadly](https://sideloadly.io) also works: drag the `.ipa` in and press Start.

### C. The app, via Xcode

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

With a free Apple ID the app stops opening after **7 days**; plug in and press Run again (logins are kept). A paid Apple Developer account ($99/year) makes each install last a year.

## Make it the default

Do this once for Instagram and once for Facebook:

1. Open **Shortcuts → Automation → New Automation** (the **+**).
2. Choose **App** → pick **Instagram** → tick **Is Opened** → select **Run Immediately** → **Next**.
3. **New Blank Automation** → add the action **Open URLs** with the link for your setup → **Done**.
4. Repeat for **Facebook**.

| | Instagram | Facebook |
|---|---|---|
| **Safari (A)** | `x-safari-https://www.instagram.com/?variant=following` | `x-safari-https://m.facebook.com/?filter=friends&sk=h_chr` |
| **App (B, C)** | `reelsblocker://instagram` | `reelsblocker://facebook` |

The `x-safari-` prefix makes iOS open the link in Safari rather than bouncing straight back into the Instagram app.

Now tapping Instagram, Facebook or one of their notifications takes you to the Reels-free version.

Then tidy up the Home Screen: long-press the Instagram and Facebook icons → **Remove from Home Screen** (not *Delete App*), and put Reels Blocker (or a Safari Favorite) in their place. Keep the real apps installed so you still get notifications.

## Watching a reel someone sent you

- **Instagram DMs:** open your messages in Reels Blocker and tap the reel. It plays. Swipe and you're back in the chat with a "One reel only" note.
- **Messenger / iMessage / anywhere else:** long-press the reel → **Copy link**. In the app, tap the **Paste** button at the top; in Safari, paste it into the address bar. Only that reel opens.
- Optional share-sheet shortcut: make a shortcut that *receives URLs from the Share Sheet* and runs **Open URLs** with `reelsblocker://open?url=` followed by the **URL Encode**d input. Then **Share → Watch in Reels Blocker** works from any app.

## Settings

Each script has a `SETTINGS` block at the top. In Safari (A), edit it in the Userscripts app. For the app, edit the file in this repo: push it and reinstall the new `.ipa` (B), or press Run in Xcode again (C).

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

CI (`.github/workflows/ci.yml`) runs those tests on every push, builds the app for iPhone (unsigned), checks the scripts are bundled, and attaches `ReelsBlocker.ipa` to the `latest` release.
