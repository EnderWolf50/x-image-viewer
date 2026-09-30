# Chrome Web Store listing — X Image Viewer

Copy-paste material for the Developer Dashboard (https://chrome.google.com/webstore/devconsole).

## Package

Run `./package.ps1` and upload `dist/x-image-viewer-<version>.zip`.

## Store listing

**Name:** X Image Viewer

**Summary (≤132 chars)** — from `manifest.json`:
> Better full-screen image viewer on X: click-to-navigate, in-place zoom, region copy, copy and download.

**Category:** Photos (alt: Tools)
**Language:** English (add 中文（繁體） with the zh-TW text below)

**Description (English):**
```
A better full-screen image viewer for X (Twitter).

Navigate faster
• Click the left or right strip of the image area to go to the previous / next image — no need to aim for the small arrows. ← / → work too.

Zoom in place
• Scroll the mouse wheel to zoom right at the cursor; drag to pan.
• A toolbar at the bottom of the image: zoom out / level / zoom in, region select, copy, download, reset.
• Double-click toggles 100% / 200%. Keys: 0 = 100%, + / − = zoom in / out.
• X's own layout (post panel, buttons) stays where it is.

Copy & save
• Shift + drag (or the region button) to copy just part of the image as PNG.
• Copy the whole original-size image, or download it with one click.

Esc or clicking beside the image returns to X's normal view.

Privacy: no data collection, no analytics, no accounts. Everything stays on your device.

Not affiliated with or endorsed by X Corp.
```

**Description (中文（繁體）):**
```
更好用的 X（Twitter）全螢幕圖片檢視器。

更快切換
• 點擊圖片區左右兩側的區塊即可切換上一張／下一張，不必瞄準小箭頭；也可用 ← / →。

原地縮放
• 滾輪在游標位置縮放，拖曳平移。
• 圖片下方工具列：縮小／比例／放大、框選、複製、下載、還原。
• 雙擊切換 100% / 200%；鍵盤 0 = 100%，+ / − = 放大／縮小。
• X 原本的版面（貼文面板、按鈕）維持不變。

複製與儲存
• Shift + 拖曳（或「框選」）只複製圖片的一部分為 PNG。
• 一鍵複製或下載原尺寸圖片。

按 Esc 或點擊圖片旁即回到 X 原本的檢視。

隱私：不收集任何資料、無追蹤、無需帳號，一切只在你的裝置上處理。

本擴充功能與 X Corp. 無關，亦未獲其背書。
```

## Graphics

| Asset | Size | File |
| --- | --- | --- |
| Store icon | 128×128 | `icons/icon128.png` |
| Small promo tile (required) | 440×280 | `store/promo-small-440x280.png` |
| Screenshots (1–5, required ≥1) | 1280×800 or 640×400 | **TODO — capture on x.com** |

Suggested screenshots: (1) zoomed image with the toolbar visible, (2) region selection in progress, (3) side-strip navigation highlighted.

## Privacy practices tab

**Single purpose:**
> Improve X's full-screen image viewer with click-to-navigate, in-place zoom, and copying / downloading the viewed image.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| Content scripts on `x.com` / `twitter.com` | Needed to add navigation zones, the zoom layer and the toolbar to X's image viewer, and to copy / download the image being viewed. |

(No `permissions` or extra `host_permissions` are requested.)

**Remote code:** No, I am not using remote code. (All JS is in the package.)

**Data usage:** tick **none** of the data categories. Certify:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** a public URL to `PRIVACY.md` (the repo is private — see note below).

## Notes before submitting

- The privacy policy URL must be publicly reachable. Options: make the repo public and link
  `https://github.com/EnderWolf50/x-image-viewer/blob/main/PRIVACY.md`, or publish `PRIVACY.md` as a public gist.
- Names containing a third-party brand ("X") can be flagged for impersonation; the "Not affiliated with X Corp." line and a non-X-logo icon help. If rejected, rename to e.g. "Image Viewer for X".
