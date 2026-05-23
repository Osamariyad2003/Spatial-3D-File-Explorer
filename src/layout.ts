import type { FileNode } from './shared/types';
import type { RawNode } from './scanner';

/** Radius increase per depth level — each layer is a wider ring. */
const RING_GAP = 7;

/**
 * Flatten a `RawNode` tree into a radial fan-out layout, placing only the
 * currently-visible nodes: a folder's children are laid out only when the
 * folder is in the `expanded` set. Collapsed folders are treated as leaves so
 * the angular wedges stay tight and the graph stays readable.
 */
export function layoutTree(root: RawNode, expanded: Set<string>): FileNode[] {
  const nodes: FileNode[] = [];
  const leafCounts = new Map<RawNode, number>();

  const isOpen = (node: RawNode): boolean => expanded.has(node.fsPath);

  function countLeaves(node: RawNode): number {
    const count =
      node.children.length === 0 || !isOpen(node)
        ? 1
        : node.children.reduce((sum, child) => sum + countLeaves(child), 0);
    leafCounts.set(node, count);
    return count;
  }
  countLeaves(root);

  function place(
    node: RawNode,
    angleStart: number,
    angleEnd: number,
    parentId: string | null
  ): void {
    const angle = (angleStart + angleEnd) / 2;
    const radius = node.depth * RING_GAP;

    nodes.push({
      id: node.fsPath,
      name: node.name,
      size: Math.round((node.size / 1024) * 100) / 100,
      depth: node.depth,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      z: 0,
      isDirectory: node.isDirectory,
      fileKind: node.fileKind,
      fsPath: node.fsPath,
      parentId,
      lineCount: node.lineCount,
      importCount: node.importCount,
      childCount: node.childCount,
      expanded: isOpen(node),
    });

    // A collapsed folder hides its children — stop here.
    if (!isOpen(node)) {
      return;
    }

    const total = leafCounts.get(node) ?? 1;
    let cursor = angleStart;
    for (const child of node.children) {
      const fraction = (leafCounts.get(child) ?? 1) / total;
      const childEnd = cursor + fraction * (angleEnd - angleStart);
      place(child, cursor, childEnd, node.fsPath);
      cursor = childEnd;
    }
  }

  place(root, 0, Math.PI * 2, null);
  return nodes;
}
