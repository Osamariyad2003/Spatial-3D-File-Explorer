# Deploying Spatial 3D File Explorer

This guide covers publishing the extension to all three distribution channels: the **VS Code Marketplace** (Microsoft), the **Open VSX Registry** (used by VSCodium, Cursor, Gitpod, and other forks), and a **GitHub Release** with the `.vsix` attached.

Most steps below have to be done by you because they require accounts and access tokens.

---

## 0. One-time prerequisites

Before any of this works you need:

- A **GitHub repository** for this project.
- A **128 × 128 PNG icon** at `media/icon-128.png` (the Marketplace shows a placeholder without one).
- These edits to [package.json](package.json), replacing the placeholders:
  - `publisher` — your Marketplace / Open VSX publisher ID (must be the same on both, or you can pick different IDs and run the commands separately).
  - `repository.url`, `bugs.url`, `homepage` — your GitHub URLs.
- Then add the icon reference. After dropping `media/icon-128.png` into the repo, add `"icon": "media/icon-128.png"` to the top of `package.json` (anywhere alongside `displayName` etc.).

Once that's done:

```bash
npm install
git init       # if not already
git remote add origin https://github.com/<your-username>/spatial-3d-file-explorer.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

---

## 1. VS Code Marketplace

### Create the publisher (one-time)

1. Go to https://dev.azure.com and sign in (free Microsoft account).
2. Create an organisation if you don't have one.
3. Visit https://marketplace.visualstudio.com/manage and **create a publisher**. The ID you pick must match `publisher` in `package.json`.

### Get a Personal Access Token (one-time)

1. In Azure DevOps → **User settings → Personal access tokens → New Token**.
2. **Organization**: "All accessible organizations".
3. **Scopes**: switch to "Show all scopes", then enable **Marketplace → Manage**.
4. Copy the token. You won't be shown it again.

### Publish

```bash
# Either log in once (recommended) …
npx vsce login your-publisher-id
# … or pass the token inline via the VSCE_PAT env var.

# Bump the version + publish in one shot:
npm run publish:vsce -- patch    # or minor / major / 0.1.1 etc.
```

The extension appears on https://marketplace.visualstudio.com/items?itemName=your-publisher-id.spatial-3d-file-explorer within a couple of minutes.

---

## 2. Open VSX Registry

### Create the account (one-time)

1. Sign in at https://open-vsx.org with your GitHub account.
2. Agree to the **Publisher Agreement**: https://open-vsx.org/user-settings/agreement.
3. Create a namespace matching the `publisher` field in `package.json`: https://open-vsx.org/user-settings/namespaces.
4. Generate an access token: https://open-vsx.org/user-settings/tokens.

### Publish

```bash
# Build the .vsix first if it's not already current.
npm run package

# Publish — the package script names the file with the version.
OVSX_PAT=<your-open-vsx-token> npm run publish:ovsx
```

(On Windows PowerShell: `$env:OVSX_PAT="..."; npm run publish:ovsx`.)

---

## 3. GitHub Release with the .vsix

After tagging:

```bash
# Make sure the package is built for the current version.
npm run package

# Tag and push.
npm run release:tag

# Create the release and attach the .vsix (requires the `gh` CLI authed against the repo).
gh release create "v$(node -p "require('./package.json').version")" \
  --title "v$(node -p "require('./package.json').version")" \
  --notes-file CHANGELOG.md \
  "spatial-3d-file-explorer-$(node -p "require('./package.json').version").vsix"
```

Users can now download the `.vsix` from the release page and install it via **Extensions → ⋯ → Install from VSIX…**.

---

## 4. (Optional) Automate everything with GitHub Actions

A workflow is wired up at [.github/workflows/release.yml](.github/workflows/release.yml). It triggers on any pushed tag of the form `v*` and:

1. Installs deps, type-checks, builds the production bundles.
2. Packages the `.vsix`.
3. Publishes to the VS Code Marketplace (needs `VSCE_PAT` repo secret).
4. Publishes to Open VSX (needs `OVSX_PAT` repo secret).
5. Creates a GitHub Release with the `.vsix` attached, using the `CHANGELOG.md` as the release notes.

To use it:

1. **GitHub → Settings → Secrets and variables → Actions → New repository secret**.
2. Add `VSCE_PAT` (your Azure DevOps token) and `OVSX_PAT` (your Open VSX token).
3. Bump the version in `package.json`, commit, then `npm run release:tag`. The workflow takes care of the rest.

---

## Release checklist (every release)

- [ ] Bump `version` in [package.json](package.json).
- [ ] Add a section to [CHANGELOG.md](CHANGELOG.md).
- [ ] Commit and push to `main`.
- [ ] `npm run release:tag` (pushes a `v<version>` tag).
- [ ] Verify the GitHub Action ran green, or run `publish:vsce` / `publish:ovsx` manually.
- [ ] Smoke-test the published extension by installing it in a clean VS Code window.
