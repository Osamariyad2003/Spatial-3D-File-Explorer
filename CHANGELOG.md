# Changelog

All notable changes to the Spatial 3D File Explorer extension.

## [0.1.0] — 2026-05-23

Initial release.

### Features

- Real-time **3D force-directed node graph** of the workspace, rendered with Three.js / React Three Fiber.
- **Colour-coded spheres** by file kind: code (capsule blue), asset (orange), folder (yellow), executable (green), symlink (purple), missing (red).
- **Curved tube connectors** between parent and child nodes.
- **Free orbit + zoom + pan** with a near-isometric default camera.
- **Click a folder** to expand/collapse; **click a file** to open it in the editor.
- **Auto-expand** root, top-level folders, and "wrapper" chains (e.g., `repo/src/main/`) on first load.
- **Search bar** that walks the full tree, auto-expands the path to every match, and dim/highlights non-matches.
- **Live filesystem sync** via `vscode.workspace.createFileSystemWatcher` (≤ 150 ms debounce, well inside the 300 ms re-index budget).
- **Multi-root workspace** support — folders are grouped under a virtual "Workspace" hub.
- **Theme-aware** colours derived from `--vscode-*` CSS variables; reacts to Light/Dark/high-contrast switches.
- **Per-node name labels** rendered as HTML overlays (no external font fetch).
- **Strict CSP** with nonce-tagged scripts and restricted `localResourceRoots`.
