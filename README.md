# PostIt — Extension

This document targets developers who want to build, debug or extend the PostIt VS Code extension.

## Overview
PostIt is a minimal Webview-based VS Code extension that offers small sticky notes persisted locally using `ExtensionContext.globalState`. The extension exposes a status-bar command (`postit.toggle`) which opens a WebviewPanel beside the editor containing the note UI.

Goals:
- Very lightweight runtime and build-time configuration
- Simple local persistence (no network)
- Webview handshake to avoid race conditions

## Architecture
- `src/extension.ts` — extension entry point, registers commands and manages the WebviewPanel lifecycle.
- `src/html-template.ts` — produces the Webview HTML/CSS/JS. The webview sends/receives messages via `postMessage`.
- `media/` — static assets (icon.svg).
- `tsconfig.json` — TypeScript configuration (incremental build enabled, no sourcemaps for a lighter build).

Persistence:
- Key: `postit.notes` stored in `context.globalState` as an array of notes: `{ text: string, color: string }[]`.

Webview handshake:
- Webview posts `{ type: 'ready' }` when initialized.
- Extension replies with `{ type: 'init', value: notes, theme }`.

Message protocol (webview <-> extension)
- From webview to extension:
  - `ready` — webview loaded and ready for init
  - `save` { index, value, color } — save note at index
  - `add` { value, color } — add a new note
  - `delete` { index } — delete note (no confirmation)
  - `requestDelete` { index } — extension shows modal confirmation then may delete
  - `changeColor` { index, color } — change color
  - `reorder` { value: Array<{text,color}> } — reorder notes array
- From extension to webview:
  - `init` { value: notes, theme } — initial payload
  - `added` { index, value, color } — at add, extension returns the assigned index so webview can set `data-index`
  - `theme` { value } — theme changed event

## Files of interest
- `src/extension.ts` — command registration, WebviewPanel creation (`retainContextWhenHidden: false` by default), message handling and globalState updates.
- `src/html-template.ts` — inline HTML/CSP/nonce generation and webview script.
- `media/icon.svg` — activity bar / fallback icon.
- `tsconfig.json` — lightweight settings used for faster incremental builds.
- `package.json` — contributes commands and configuration keys.

## Build & Run (development)
1. cd into extension directory:
   - `cd extension-vscode`
2. Install exact dev deps from lockfile (reproducible):
   - `npm ci`
3. Build:
   - `npm run build`
4. Launch Extension Development Host
   - From root of the workspace or extension folder: `code --extensionDevelopmentPath=.`, or press F5 in the extension VS Code debug configuration.

Useful scripts (from `package.json`):
- `npm run build` — compile TypeScript (tsc -p ./)
- `npm run watch` — tsc watch mode

## Lint / TypeScript
- `tsconfig.json` is optimized for speed: `incremental: true`, `sourceMap: false`, `declaration: false`.
- If you enable stricter checks for development, consider toggling `strict` or `noUnusedLocals` locally.

## Packaging & Publishing
- Ensure `npm run build` completes and `out/` contains the compiled extension.
- Use `vsce` or `@vscode/vsce` to package and publish to Marketplace.

## Performance notes
- `retainContextWhenHidden` is set to `false` to reduce memory usage while the Webview is hidden (trades off keeping live DOM state when hidden).
- Webview handshake avoids unnecessary re-renders and race conditions.
- `tsconfig` is tuned for incremental builds and minimal emitted artifacts.

## Extending the extension
- To embed the full UI inside the Activity Bar view (instead of opening a floating panel), implement a `WebviewViewProvider` and render the same HTML. Be mindful of available height and `retainContextWhenHidden` semantics.

## Troubleshooting
- Error "There is no data provider registered that can provide view data." — indicates a contributed view exists but no `WebviewViewProvider` is registered. Ensure `vscode.window.registerWebviewViewProvider('viewId', provider)` is called during activation if you contribute `views` in `package.json`.

## Contact / Contributing
Open issues or PRs against the repository. Keep changes small and focused on low-runtime overhead.

---

If you want, I can also add a `DEVELOPMENT.md` with step-by-step debugging scenarios and a minimal test skeleton. Want that?
