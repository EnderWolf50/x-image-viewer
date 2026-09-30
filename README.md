# X Image Viewer

Chrome extension (Manifest V3) that improves the full-screen image viewer on X (x.com / twitter.com).

- Click the **left / right strip** of the image column to go to the previous / next image (← / → also work).
- **In-place zoom** with a toolbar at the bottom of the image:
  `[ ← ] [ ⊖ | 100% | ⊕ ] [ 框選 | 複製 | 下載 ] [ 還原 ] [ → ]`
- While zoomed:

| Input | Action |
| --- | --- |
| Wheel | Zoom at the cursor (also starts zooming) |
| Drag | Pan |
| Shift + drag / 框選 | Select a region → copied as PNG |
| Ctrl/⌘ + C / 複製 | Copy the whole image |
| 下載 | Download the original image |
| Double-click | Toggle 100% / 200% |
| `0` / `+` / `-` | 100% / zoom in / zoom out |
| Esc, or click beside the image | Back to X's normal view |

## Install (development)

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → pick this folder.

## Files

| File | Role |
| --- | --- |
| `nav.js` | Side-strip click navigation. |
| `zoom.js` | Zoom layer, toolbar, region copy, copy and download. |

## Publish

```powershell
./package.ps1   # -> dist/x-image-viewer-<version>.zip
```

Store listing text, permission justifications and privacy answers: [`store/LISTING.md`](store/LISTING.md).
Privacy policy: [`PRIVACY.md`](PRIVACY.md).

Works alongside [X Quick Copy](https://github.com/EnderWolf50/x-quick-copy).

*Not affiliated with or endorsed by X Corp.*
