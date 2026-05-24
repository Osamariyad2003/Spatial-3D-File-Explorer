# Spatial 3D File Explorer

> A real-time 3D node graph of your workspace files and folders, right inside VS Code.
> Orbit, zoom, search, and click to open — turn a flat tree into a navigable map.

[![CI](https://github.com/Osamariyad2003/Spatial-3D-File-Explorer/actions/workflows/ci.yml/badge.svg)](https://github.com/Osamariyad2003/Spatial-3D-File-Explorer/actions/workflows/ci.yml)
[![Release](https://github.com/Osamariyad2003/Spatial-3D-File-Explorer/actions/workflows/release.yml/badge.svg)](https://github.com/Osamariyad2003/Spatial-3D-File-Explorer/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85-007ACC?logo=visualstudiocode)](https://code.visualstudio.com/)
[![Three.js](https://img.shields.io/badge/three.js-r161-000000?logo=three.js)](https://threejs.org/)
[![Built with React Three Fiber](https://img.shields.io/badge/R3F-8.x-61dafb?logo=react)](https://github.com/pmndrs/react-three-fiber)

---

## Preview

![Spatial 3D File Explorer – Repo Map](docs/preview.png)

> **Repo Map** — a live summary panel above the graph shows at a glance:
> `NODES` · `FOLDERS` · `CODE` · `ASSETS`
>
> The force-directed graph uses colour-coded spheres (see legend below) with
> drag, scroll-zoom, and click-to-open controls.
>
> **Legend**
>
> | Colour | Type       |
> | ------ | ---------- |
> | Yellow | Folder     |
> | Blue   | Code       |
> | Orange | Asset      |
> | Green  | Executable |
> | Purple | Symlink    |
> | Red    | Missing    |

---

## Why?

Tree views are great for small projects and terrible for big ones. Once a repo
crosses a few hundred files, the sidebar becomes an infinite-scroll mystery.

Spatial 3D File Explorer renders your workspace as a force-directed graph of
colour-coded spheres, so structure becomes something you can *see*: clusters
of code, isolated assets, dead-end folders, hub modules with dozens of
children. Click a sphere to open a file. Type to search and the graph dims
everything that doesn't match.

It's an experiment in cognitive offloading — let your spatial memory do the
work your `Ctrl+P` muscle memory currently has to.

## Features

- **Repo Map stats panel** — live counts of total nodes, folders, code files,
  and assets displayed above the graph at all times.
- **3D force-directed graph** of the entire workspace, rendered with Three.js
  and React Three Fiber.
- **Colour-coded spheres** by file kind:
  - blue capsule — source code
  - orange — assets (images, fonts, media)
  - yellow — folders
  - green — executables
  - purple — symlinks
  - red — missing / broken
- **Curved tube connectors** between parents and children.
- **Free orbit, zoom, and pan** with a near-isometric default camera.
- **Click a folder** to expand or collapse it; **click a file** to open it in
  the editor.
- **Smart auto-expand** for the root, top-level folders, and "wrapper" chains
  like `repo/src/main/` on first load.
- **Search bar** that walks the full tree, auto-expands every match's path,
  and dim/highlights the rest.
- **Live filesystem sync** via `vscode.workspace.createFileSystemWatcher` —
  debounced to ≤ 150 ms, well inside the 300 ms re-index budget.
- **Multi-root workspace** support — folders are grouped under a virtual
  "Workspace" hub.
- **Theme-aware** colours derived from `--vscode-*` CSS variables, reacting
  to Light, Dark, and high-contrast switches.
- **HTML name labels** per node (no external font fetch).
- **Strict CSP** with nonce-tagged scripts and restricted `localResourceRoots`.

## Install

### From the VS Code Marketplace

Search for **Spatial 3D File Explorer** in the Extensions view, or install
from the command line:

```bash
code --install-extension spatial-3d-file-explorer.spatial-3d-file-explorer
```

### From Open VSX (VSCodium, Cursor, Gitpod, etc.)

```bash
codium --install-extension spatial-3d-file-explorer.spatial-3d-file-explorer
```

### From a `.vsix`

Grab the latest release from the
[Releases page](https://github.com/Osamariyad2003/Spatial-3D-File-Explorer/releases),
then:

```
VS Code → Extensions → ⋯ → Install from VSIX…
```

## Usage

1. Open a folder or workspace in VS Code.
2. Click the **3D Explorer** icon in the activity bar (left sidebar).
3. The graph fills the panel.

| Action               | Mouse / Keyboard                          |
| -------------------- | ----------------------------------------- |
| Orbit                | Left-click + drag                         |
| Pan                  | Right-click + drag (or middle-click drag) |
| Zoom                 | Scroll wheel                              |
| Open a file          | Click its sphere                          |
| Expand / collapse    | Click a folder sphere                     |
| Search               | Type into the search bar                  |
| Clear search         | Empty the search bar                      |

## Development

Requirements: Node.js 18+ and VS Code 1.85+.

```bash
npm install
npm run build       # one-off dev build
npm run watch       # rebuild on change
npm run typecheck   # type-check extension + webview
```

Then press `F5` in VS Code to launch the **Extension Development Host** with
the extension loaded.

### Project layout

```
src/                       # extension host (Node, runs in VS Code)
  extension.ts             # activate() — registers the webview provider
  FileExplorerViewProvider # webview host, IPC, CSP, theme bridge
  scanner.ts               # filesystem walk + FileSystemWatcher
  layout.ts                # initial positioning before the force pass
  shared/types.ts          # shared message + node types
webview/                   # sandboxed UI (runs in the webview iframe)
  index.tsx                # React entry
  App.tsx                  # search bar, error boundary, scene wiring
  Scene.tsx                # camera, lights, controls
  SphereNode.tsx           # per-node sphere + label
  Connectors.tsx           # curved tube connectors
  FitCamera.tsx            # camera framing helpers
  forceLayout.ts           # client-side force-directed solver
  useVsCodeMessages.ts     # postMessage bridge hook
  theme.ts                 # VS Code → Three.js colour mapping
```

### Architecture

The extension host (`src/`) scans the filesystem with VS Code's
`FileSystemWatcher`, builds a positioned `FileNode[]` layout, and ships it
over a `postMessage` IPC bridge to a sandboxed webview (`webview/`) that
renders the scene with React Three Fiber. The webview never touches the
filesystem directly — every action (open file, expand folder) goes back
through the same bridge with a typed message.

```
┌──────────────┐    postMessage     ┌──────────────┐
│  extension   │ ─────────────────▶ │   webview    │
│  host (Node) │                    │  (R3F + TS)  │
│              │ ◀───────────────── │              │
│ scanner +    │   open / expand    │ force layout │
│ watcher +    │                    │ + scene      │
│ layout       │                    │              │
└──────────────┘                    └──────────────┘
```

### Packaging

```bash
npm run package    # produces spatial-3d-file-explorer.vsix
```

For full publishing instructions (Marketplace, Open VSX, GitHub Releases, and
the CI workflow), see [DEPLOYING.md](DEPLOYING.md).

## Contributing

Contributions are welcome — bug reports, feature ideas, and pull requests
all land in the same place:
[github.com/Osamariyad2003/Spatial-3D-File-Explorer](https://github.com/Osamariyad2003/Spatial-3D-File-Explorer).

A good PR generally:

1. Starts from an issue (or comments on one) so we agree on the shape of the
   change before code is written.
2. Keeps the extension-host / webview boundary clean — anything filesystem-
   or VS Code-API-related lives in `src/`, anything rendering-related lives
   in `webview/`, and they only talk through `src/shared/types.ts` messages.
3. Passes `npm run typecheck` on both targets. CI runs typecheck + build on
   every push to `main` and every PR — see
   [.github/workflows/ci.yml](.github/workflows/ci.yml).
4. Includes a one-line entry in [CHANGELOG.md](CHANGELOG.md) under
   `## [Unreleased]`.

If you're not sure where to start, look for issues tagged `good first issue`.

## Roadmap

- Per-file-type filters in the search bar
- Saved "viewpoints" (camera + filter state) per workspace
- Optional dependency-graph edges (imports / requires) alongside the
  filesystem edges
- Performance budget for very large monorepos (10k+ files)

Have an idea? Open an issue.

## License

[MIT](LICENSE) © 2026 Osama Riyad and contributors.

Built with [Three.js](https://threejs.org/),
[React Three Fiber](https://github.com/pmndrs/react-three-fiber), and
[drei](https://github.com/pmndrs/drei).
