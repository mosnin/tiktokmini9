# Outfit Panic

A portrait first TikTok Mini Game about reading fast fashion prompts, selecting the right look before the timer expires, building audience streaks, and upgrading a permanent closet.

## Play locally

Serve this folder with any static server, then open `index.html`.

```sh
npx serve .
```

The browser mock completes ads only on localhost or from a local file. A TikTok build should provide `window.TIKTOK_GAME_CONFIG` with `clientKey`, `rewardedAdId`, and `interstitialAdId`, then load the TikTok Mini Games SDK before `game.js`.

The optional Stylist Pass rewarded offer highlights three correct looks and pauses the timer only after the player taps the offer. Every fifth permanent upgrade level is rewarded gated. Rewards are granted only after the SDK reports that the video ended.
