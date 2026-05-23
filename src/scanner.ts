import { promises as fs, type Dirent } from 'fs';
import * as path from 'path';
import type { FileKind } from './shared/types';

export interface RawNode {
  name: string;
  fsPath: string;
  isDirectory: boolean;
  fileKind: FileKind;
  size: number;
  depth: number;
  lineCount: number;
  importCount: number;
  childCount: number;
  children: RawNode[];
}

const CODE_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.php', '.swift', '.kt', '.vue', '.svelte', '.elm',
  '.ex', '.exs', '.lua', '.r', '.scala', '.clj', '.zig',
]);

const EXECUTABLE_EXTS = new Set([
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.exe',
]);

const IGNORED = new Set([
  'node_modules', '.git', '.hg', '.svn',
  'dist', 'build', '.next', 'out', '.cache', '__pycache__',
]);

const MAX_DEPTH = 4;
const MAX_NODES = 500;
const MAX_READ_BYTES = 256 * 1024;

const IMPORT_RE = /^\s*(?:import\b|from\s+['"]|require\s*\()/gm;

async function codeMetrics(filePath: string, sizeBytes: number): Promise<{ lineCount: number; importCount: number }> {
  if (sizeBytes > MAX_READ_BYTES) {
    return { lineCount: Math.round(sizeBytes / 45), importCount: 0 };
  }
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return {
      lineCount: content.split('\n').length,
      importCount: (content.match(IMPORT_RE) ?? []).length,
    };
  } catch {
    return { lineCount: 0, importCount: 0 };
  }
}

function classifyEntry(entry: Dirent, ext: string): FileKind {
  if (entry.isSymbolicLink()) return 'symlink';
  if (EXECUTABLE_EXTS.has(ext)) return 'executable';
  if (CODE_EXTS.has(ext)) return 'code';
  return 'asset';
}

interface ScanCtx { count: number }

/** Synthetic id for the virtual root that groups multiple workspace folders. */
const VIRTUAL_ROOT_ID = '__spatial3d_workspace_root__';

export async function scanWorkspace(rootPath: string): Promise<RawNode> {
  return walk(rootPath, 0, { count: 0 }, MAX_DEPTH);
}

/**
 * Scan every workspace folder and group them beneath one virtual root, so a
 * multi-root window shows all of its folders. Folders start one level deep, so
 * the depth budget is raised by one to keep per-folder reach identical to the
 * single-root case. The node-count cap is shared across all folders.
 */
export async function scanWorkspaces(rootPaths: string[]): Promise<RawNode> {
  const ctx: ScanCtx = { count: 0 };
  const children: RawNode[] = [];
  for (const rootPath of rootPaths) {
    children.push(await walk(rootPath, 1, ctx, MAX_DEPTH + 1));
  }
  return {
    name: 'Workspace',
    fsPath: VIRTUAL_ROOT_ID,
    isDirectory: true,
    fileKind: 'directory',
    size: children.reduce((sum, child) => sum + child.size, 0),
    depth: 0,
    lineCount: 0,
    importCount: 0,
    childCount: children.length,
    children,
  };
}

async function walk(dirPath: string, depth: number, ctx: ScanCtx, maxDepth: number): Promise<RawNode> {
  const node: RawNode = {
    name: path.basename(dirPath) || dirPath,
    fsPath: dirPath,
    isDirectory: true,
    fileKind: 'directory',
    size: 0,
    depth,
    lineCount: 0,
    importCount: 0,
    childCount: 0,
    children: [],
  };

  if (depth >= maxDepth) return node;

  let entries: Dirent[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return node;
  }

  for (const entry of entries) {
    if (ctx.count >= MAX_NODES) break;
    if (IGNORED.has(entry.name)) continue;

    const childPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      ctx.count += 1;
      const child = await walk(childPath, depth + 1, ctx, maxDepth);
      node.children.push(child);
      node.size += child.size;
      node.childCount += 1;
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      ctx.count += 1;
      const ext = path.extname(entry.name).toLowerCase();
      let kind = classifyEntry(entry, ext);
      let bytes = 0;
      let lineCount = 0;
      let importCount = 0;

      try {
        bytes = (await fs.stat(childPath)).size;
        if (kind === 'code') {
          ({ lineCount, importCount } = await codeMetrics(childPath, bytes));
        }
      } catch {
        kind = 'deleted';
      }

      node.children.push({
        name: entry.name,
        fsPath: childPath,
        isDirectory: false,
        fileKind: kind,
        size: bytes,
        depth: depth + 1,
        lineCount,
        importCount,
        childCount: 0,
        children: [],
      });
      node.size += bytes;
      node.childCount += 1;
    }
  }

  return node;
}
