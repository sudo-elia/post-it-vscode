import * as vscode from "vscode";
import { htmlContent } from "./html-template";

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(note) post-it";
  statusBarItem.tooltip = "Open Post-it";
  statusBarItem.command = "postit.toggle";
  statusBarItem.show();

  const disposable = vscode.commands.registerCommand(
    "postit.toggle",
    async () => {
      if (panel) {
        panel.reveal();
        return;
      }

      panel = vscode.window.createWebviewPanel(
        "postit",
        "Post-it",
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: false }
      );

      panel.webview.html = getWebviewContent(context, panel.webview);

      function normalizeNotes(raw: any[]): { text: string; color: string }[] {
        if (!Array.isArray(raw)) return [];
        return raw.map((item) => {
          if (typeof item === "string") return { text: item, color: "yellow" };
          return {
            text: String(item?.text ?? ""),
            color: String(item?.color ?? "yellow"),
          };
        });
      }

      async function persistAndPost(notes: { text: string; color: string }[]) {
        await context.globalState.update("postit.notes", notes);
        await panel?.webview.postMessage({ type: "init", value: notes });
      }

      const raw = context.globalState.get<any[]>("postit.notes", []);
      const initialNotes = normalizeNotes(raw);

      const msgDisposable = panel.webview.onDidReceiveMessage(
        async (message: any) => {
          if (!message || !message.type) return;

          if (message.type === "ready") {
            const themeKind = vscode.window.activeColorTheme?.kind ?? 1;
            await panel?.webview.postMessage({
              type: "init",
              value: initialNotes,
              theme: themeKind,
            });
            return;
          }

          const notes = normalizeNotes(
            context.globalState.get<any[]>("postit.notes", [])
          );

          async function withValidIndex(
            message: any,
            notes: { text: string; color: string }[],
            fn: (
              notes: { text: string; color: string }[],
              idx: number
            ) => Promise<void>
          ) {
            const idx = typeof message.index === "number" ? message.index : -1;
            if (idx < 0 || idx >= notes.length) return;
            await fn(notes, idx);
          }

          switch (message.type) {
            case "save": {
              await withValidIndex(message, notes, async (notes, idx) => {
                notes[idx].text = message.value ?? "";
                notes[idx].color =
                  message.color ?? notes[idx].color ?? "yellow";
                await persistAndPost(notes);
              });
              break;
            }
            case "add": {
              notes.push({
                text: message.value ?? "",
                color: message.color ?? "yellow",
              });
              await context.globalState.update("postit.notes", notes);
              const newIdx = notes.length - 1;
              await panel?.webview.postMessage({
                type: "added",
                index: newIdx,
                value: notes[newIdx].text,
                color: notes[newIdx].color,
              });
              break;
            }
            case "delete": {
              await withValidIndex(message, notes, async (notes, idx) => {
                notes.splice(idx, 1);
                await persistAndPost(notes);
              });
              break;
            }
            case "requestDelete": {
              const idx =
                typeof message.index === "number" ? message.index : -1;
              if (idx >= 0) {
                const confirm = await vscode.window.showWarningMessage(
                  "Delete this Post-it?",
                  { modal: true },
                  "Delete"
                );
                if (confirm === "Delete") {
                  if (idx < notes.length) {
                    notes.splice(idx, 1);
                    await persistAndPost(notes);
                  }
                }
              }
              break;
            }
            case "changeColor": {
              const idx =
                typeof message.index === "number" ? message.index : -1;
              if (idx >= 0 && idx < notes.length) {
                notes[idx].color = String(message.color ?? "yellow");
                await persistAndPost(notes);
              }
              break;
            }
            case "reorder": {
              if (Array.isArray(message.value)) {
                const normalized = normalizeNotes(message.value);
                await persistAndPost(normalized);
              }
              break;
            }
          }
        }
      );

      vscode.window.onDidChangeActiveColorTheme((e) => {
        const k = e.kind ?? vscode.ColorThemeKind.Light;
        panel?.webview.postMessage({ type: "theme", value: k });
      });

      panel.onDidDispose(() => {
        msgDisposable.dispose();
        panel = undefined;
      });
    }
  );

  context.subscriptions.push(disposable, statusBarItem);
}

function getWebviewContent(_, webview: vscode.Webview) {
  const nonce = getNonce();
  return htmlContent(webview, nonce);
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
