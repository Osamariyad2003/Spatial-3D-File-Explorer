import type { FileNode } from '../src/shared/types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const REPULSION = 110;
const SPRING_LENGTH = 7;
const SPRING_K = 0.045;
const CENTER_K = 0.006;
const DAMPING = 0.85;
const ITERATIONS = 240;

/** Z distance between consecutive depth layers (root depth = 0, deeper = further back). */
const LAYER_Z_GAP = 11;
/** Strength of the per-depth Z-plane attraction — keeps the graph layered in 3D. */
const LAYER_PULL = 0.11;

function seedZ(node: FileNode, index: number): number {
  const layer = node.depth * LAYER_Z_GAP;
  const jitter = ((index * 0.6180339887) % 1 - 0.5) * 1.5;
  return layer + jitter;
}

/**
 * 3D force-directed layout — repulsion between every pair, spring along each
 * parent→child edge, and a per-depth Z-plane attraction so the graph stays
 * obviously 3D (depth 0 in front, deeper folders further back). Seeded
 * deterministically; settles in ~240 iterations.
 */
export function runForceLayout(nodes: FileNode[]): Map<string, Vec3> {
  const positions = new Map<string, Vec3>();
  const velocities = new Map<string, Vec3>();

  nodes.forEach((node, index) => {
    positions.set(node.id, { x: node.x, y: node.y, z: seedZ(node, index) });
    velocities.set(node.id, { x: 0, y: 0, z: 0 });
  });

  const edges: Array<[string, string]> = [];
  for (const node of nodes) {
    if (node.parentId && positions.has(node.parentId)) {
      edges.push([node.id, node.parentId]);
    }
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map<string, Vec3>();
    for (const node of nodes) {
      forces.set(node.id, { x: 0, y: 0, z: 0 });
    }

    // Pairwise repulsion.
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const pa = positions.get(a.id)!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const pb = positions.get(b.id)!;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dz = pa.z - pb.z;
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.01) dist = 0.01;
        const f = REPULSION / (dist * dist);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        const fz = (dz / dist) * f;
        const fa = forces.get(a.id)!;
        const fb = forces.get(b.id)!;
        fa.x += fx; fa.y += fy; fa.z += fz;
        fb.x -= fx; fb.y -= fy; fb.z -= fz;
      }
    }

    // Spring attraction along parent→child edges.
    for (const [aId, bId] of edges) {
      const pa = positions.get(aId)!;
      const pb = positions.get(bId)!;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dz = pb.z - pa.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      const displacement = dist - SPRING_LENGTH;
      const f = SPRING_K * displacement;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      const fz = (dz / dist) * f;
      const fa = forces.get(aId)!;
      const fb = forces.get(bId)!;
      fa.x += fx; fa.y += fy; fa.z += fz;
      fb.x -= fx; fb.y -= fy; fb.z -= fz;
    }

    // X/Y centring (Z is governed by per-depth layer pull below).
    for (const node of nodes) {
      const p = positions.get(node.id)!;
      const f = forces.get(node.id)!;
      f.x -= p.x * CENTER_K;
      f.y -= p.y * CENTER_K;
    }

    // Per-depth Z-plane attraction — what makes the graph read as 3D.
    for (const node of nodes) {
      const p = positions.get(node.id)!;
      const f = forces.get(node.id)!;
      const targetZ = node.depth * LAYER_Z_GAP;
      f.z += (targetZ - p.z) * LAYER_PULL;
    }

    // Integrate.
    for (const node of nodes) {
      const v = velocities.get(node.id)!;
      const f = forces.get(node.id)!;
      const p = positions.get(node.id)!;
      v.x = (v.x + f.x) * DAMPING;
      v.y = (v.y + f.y) * DAMPING;
      v.z = (v.z + f.z) * DAMPING;
      p.x += v.x;
      p.y += v.y;
      p.z += v.z;
    }
  }

  return positions;
}
