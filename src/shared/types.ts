/**
 * Visual primitive category — drives geometry selection in the webview.
 *
 * code       → CapsuleGeometry   (height = line weight, radius = import density)
 * asset      → BoxGeometry plate (thin, low-profile non-code files)
 * directory  → TorusGeometry     (ring radius expands with child count)
 * symlink    → TorusGeometry     (smaller ring, hollow — points elsewhere)
 * executable → CylinderGeometry  (pillar / pipeline hub)
 * deleted    → OctahedronGeometry wireframe (broken / hazardous)
 */
export type FileKind = 'code' | 'asset' | 'directory' | 'symlink' | 'executable' | 'deleted';

export interface FileNode {
  id: string;
  name: string;
  /** Size in KB. Directories = subtree total. */
  size: number;
  depth: number;
  /** Layout coordinate — horizontal (R3F world X). */
  x: number;
  /** Layout coordinate — vertical (R3F world Y). */
  y: number;
  /** Layout coordinate — depth into the scene (R3F world Z). */
  z: number;
  isDirectory: boolean;
  fileKind: FileKind;
  fsPath: string;
  parentId: string | null;
  /** Source line count — maps to CapsuleGeometry height. */
  lineCount: number;
  /** Import / require statement count — maps to CapsuleGeometry radius. */
  importCount: number;
  /** Direct child count — maps to TorusGeometry outer radius. */
  childCount: number;
  /** Directories only — whether this folder is currently expanded. */
  expanded: boolean;
}

export interface ScanResultMessage {
  type: 'scanResult';
  nodes: FileNode[];
  /** fsPaths of nodes matching the current search query (empty when none). */
  matches: string[];
}

export type ExtensionToWebview = ScanResultMessage;

export interface ReadyMessage { type: 'ready'; }
export interface OpenFileMessage { type: 'openFile'; fsPath: string; }
/** toggleExpand: webview → extension, collapse or expand a folder's children. */
export interface ToggleExpandMessage { type: 'toggleExpand'; fsPath: string; }
/** search: webview → extension, filter the graph by a name substring. Empty clears. */
export interface SearchMessage { type: 'search'; query: string; }
export type WebviewToExtension =
  | ReadyMessage
  | OpenFileMessage
  | ToggleExpandMessage
  | SearchMessage;
