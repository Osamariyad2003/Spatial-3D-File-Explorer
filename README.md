# Spatial 3D File Explorer

A VS Code sidebar extension that renders your workspace as a real-time, 3D
volumetric layout. Folder depth and file byte size are mapped into an
interactive WebGL scene, lowering the cognitive load of navigating large
repositories.

## Features

- **Directory parsing** — recursively maps the workspace up to five layers deep.
- **Volumetric scaling** — file size drives each block's volume.
- **Live sync** — filesystem additions, deletions, and edits re-index the scene.
- **Click to open** — clicking a file box opens it in the editor.
- **Theme aware** — scene colours follow the active VS Code theme.

## Usage

Open the **3D Explorer** view from the activity bar. Orbit with click-drag,
zoom with the scroll wheel, hover a box to highlight it, and click to open the
file.

## Development

```bash
npm install
npm run build      # dev build
npm run watch      # rebuild on change
npm run typecheck  # type-check both targets
```

Press `F5` in VS Code to launch the Extension Development Host.

## Packaging

```bash
npm run package    # produces spatial-3d-file-explorer.vsix
```

## Architecture

The extension host (`src/`) scans the filesystem with VS Code's
`FileSystemWatcher`, builds a positioned `FileNode[]` layout, and ships it over
the `postMessage` IPC bridge to a sandboxed webview (`webview/`) that renders
the scene with React Three Fiber and Three.js.
