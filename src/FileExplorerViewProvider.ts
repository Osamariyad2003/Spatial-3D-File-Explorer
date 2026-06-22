import * as vscode from 'vscode';
import { scanWorkspace, scanWorkspaces, type RawNode } from './scanner';
import { layoutTree } from './layout';
import type { WebviewToExtension } from './shared/types';

/** Debounce window for batching filesystem events — well inside the 300ms budget. */
const RESCAN_DEBOUNCE_MS = 150;

/**
 * Hosts the sidebar webview: serves its HTML, scans the workspace, and bridges
 * messages between the privileged extension host and the sandboxed canvas.
 */
export class FileExplorerViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'spatial3dExplorer.view';

  private view?: vscode.WebviewView;
  private watchers: vscode.FileSystemWatcher[] = [];
  private rescanTimer?: NodeJS.Timeout;
  private readonly disposables: vscode.Disposable[] = [];

  /** Full scanned tree, retained so expand/collapse can re-layout without re-scanning. */
  private rootTree?: RawNode;
  /** fsPaths of folders whose children are currently shown. */
  private readonly expanded = new Set<string>();
  /** Folder fsPaths auto-expanded to reveal the current search matches. */
  private readonly searchExpanded = new Set<string>();
  /** fsPaths of nodes whose name matches the current search query. */
  private readonly searchMatches = new Set<string>();
  /** Current search query (lower-cased), or null when no search is active. */
  private searchQuery: string | null = null;
  /** True once the one-shot initial auto-expand has run for this provider. */
  private autoExpandDone = false;
  /** Diagnostic log — visible in Output → "Spatial 3D File Explorer". */
  private readonly output = vscode.window.createOutputChannel('Spatial 3D File Explorer');

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      // SRS §4.2 — restrict disk access to the extension's own asset folders.
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'media'),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewToExtension) => this.handleMessage(message),
      undefined,
      this.disposables
    );

    webviewView.onDidDispose(() => this.dispose(), undefined, this.disposables);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void this.scanAndSend();
      }
    }, undefined, this.disposables);

    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.refreshWatchers();
        this.scheduleRescan();
      })
    );
    this.refreshWatchers();
  }

  private async handleMessage(message: WebviewToExtension): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.scanAndSend();
        break;
      case 'openFile':
        await this.openFile(message.fsPath);
        break;
      case 'toggleExpand':
        this.toggleExpand(message.fsPath);
        break;
      case 'search':
        this.applySearch(message.query);
        break;
    }
  }

  /** SRS §2.2 — tunnel a raycast click back into the editor. */
  private async openFile(fsPath: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fsPath));
      await vscode.window.showTextDocument(document, { preview: true });
    } catch {
      void vscode.window.showErrorMessage(`Spatial 3D: could not open ${fsPath}`);
    }
  }

  private async scanAndSend(): Promise<void> {
    if (!this.view) {
      this.output.appendLine('[scan] skipped: view not resolved');
      return;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this.output.appendLine('[scan] no workspace folders open');
      this.rootTree = undefined;
      void this.view.webview.postMessage({ type: 'scanResult', nodes: [] });
      return;
    }
    const paths = folders.map((folder) => folder.uri.fsPath);
    this.output.appendLine(`[scan] folders (${paths.length}): ${paths.join(' | ')}`);
    try {
      this.rootTree =
        paths.length === 1
          ? await scanWorkspace(paths[0])
          : await scanWorkspaces(paths);
      this.output.appendLine(
        `[scan] ok: root=${this.rootTree.fsPath} children=${this.rootTree.childCount}`
      );
      if (!this.autoExpandDone) {
        this.autoExpandInitial(this.rootTree, 0);
        this.autoExpandDone = true;
      }
      // Recompute search against the fresh tree (handles live re-indexing).
      this.computeSearchExpansion();
      this.render();
    } catch (err) {
      const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
      this.output.appendLine(`[scan] FAILED: ${message}`);
      this.rootTree = undefined;
      void this.view.webview.postMessage({ type: 'scanResult', nodes: [] });
    }
  }

  /** Lay out the currently-visible nodes and push them to the webview. */
  private render(): void {
    if (!this.view || !this.rootTree) {
      this.output.appendLine('[render] skipped: no view or no tree');
      return;
    }
    // The root is always expanded so the top level stays visible.
    this.expanded.add(this.rootTree.fsPath);
    // Combine user-expanded folders with the ones search needs open.
    const combined = new Set<string>(this.expanded);
    for (const fsPath of this.searchExpanded) {
      combined.add(fsPath);
    }
    const nodes = layoutTree(this.rootTree, combined);
    const matches = Array.from(this.searchMatches);
    this.output.appendLine(
      `[render] posting ${nodes.length} nodes (expanded=${combined.size}, matches=${matches.length})`
    );
    void this.view.webview.postMessage({ type: 'scanResult', nodes, matches });
  }

  /**
   * Update the active search query and recompute which folders need to be
   * expanded (the ancestor chain of every match), then re-render.
   */
  private applySearch(query: string): void {
    const trimmed = query.trim();
    this.searchQuery = trimmed === '' ? null : trimmed.toLowerCase();
    this.computeSearchExpansion();
    this.render();
  }

  /**
   * Walk the full tree, mark every node whose name matches the query, and add
   * every ancestor folder to `searchExpanded` so the match is reachable in the
   * laid-out graph.
   */
  private computeSearchExpansion(): void {
    this.searchExpanded.clear();
    this.searchMatches.clear();
    if (!this.searchQuery || !this.rootTree) {
      return;
    }
    const query = this.searchQuery;

    const walk = (node: RawNode, ancestors: string[]): void => {
      if (node.name.toLowerCase().includes(query)) {
        this.searchMatches.add(node.fsPath);
        for (const ancestor of ancestors) {
          this.searchExpanded.add(ancestor);
        }
      }
      const nextAncestors = node.isDirectory
        ? [...ancestors, node.fsPath]
        : ancestors;
      for (const child of node.children) {
        walk(child, nextAncestors);
      }
    };
    walk(this.rootTree, []);
  }

  /**
   * One-shot initial auto-expand. Always opens the root and its direct folder
   * children (depth 1), plus any deeper folders that form a "wrapper chain" —
   * a folder whose only child is itself a folder, like `repo/src/main/`. Stops
   * as soon as a folder branches, so the graph doesn't drown the viewer.
   */
  private autoExpandInitial(node: RawNode, depth: number): void {
    if (!node.isDirectory) {
      return;
    }
    this.expanded.add(node.fsPath);

    const isWrapperChain =
      node.children.length === 1 && node.children[0].isDirectory;
    const recurse = depth === 0 || isWrapperChain;
    if (!recurse) {
      return;
    }

    for (const child of node.children) {
      this.autoExpandInitial(child, depth + 1);
    }
  }

  /** Collapse or expand a folder, then re-render without re-scanning. */
  private toggleExpand(fsPath: string): void {
    if (!this.rootTree || fsPath === this.rootTree.fsPath) {
      return;
    }
    if (this.expanded.has(fsPath)) {
      this.expanded.delete(fsPath);
    } else {
      this.expanded.add(fsPath);
    }
    this.render();
  }

  /**
   * SRS §2.2 / §4.1 — one filesystem watcher per workspace folder. Re-runs when
   * folders are added or removed so the watch set stays in sync.
   */
  private refreshWatchers(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];

    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      return;
    }

    const onChange = (): void => this.scheduleRescan();
    for (const folder of folders) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, '**/*')
      );
      watcher.onDidCreate(onChange);
      watcher.onDidDelete(onChange);
      watcher.onDidChange(onChange);
      this.watchers.push(watcher);
    }
  }

  private scheduleRescan(): void {
    if (this.rescanTimer) {
      clearTimeout(this.rescanTimer);
    }
    this.rescanTimer = setTimeout(() => {
      void this.scanAndSend();
    }, RESCAN_DEBOUNCE_MS);
  }

  private dispose(): void {
    if (this.rescanTimer) {
      clearTimeout(this.rescanTimer);
      this.rescanTimer = undefined;
    }
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
    this.output.dispose();
    this.view = undefined;
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );

    // SRS §4.2 — strict CSP; only the nonce-tagged bundle may execute.
    // worker-src + blob: are required for drei <Text>, which spawns a troika
    // worker via a blob URL for font shaping.
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} data:`,
      `script-src 'nonce-${nonce}'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource} data:`,
      `worker-src ${webview.cspSource} blob:`,
      `connect-src ${webview.cspSource} data:`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spatial 3D File Explorer</title>
  <style>
    html, body, #root { height: 100%; margin: 0; padding: 0; overflow: hidden; }
    body { background: var(--vscode-editor-background); }
    canvas { display: block; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  function getNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
