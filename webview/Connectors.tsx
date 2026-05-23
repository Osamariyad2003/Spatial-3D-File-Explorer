import { useMemo } from 'react';
import * as THREE from 'three';
import type { FileNode } from '../src/shared/types';

interface ConnectorsProps {
  nodes: FileNode[];
  color: string;
  /** fsPaths of search matches (empty when no search is active). */
  matches?: Set<string>;
}

interface EdgeData {
  id: string;
  geometry: THREE.TubeGeometry;
  dimmed: boolean;
}

/**
 * Builds a 3D quadratic Bezier between two node centres. The midpoint bows
 * perpendicular to the edge direction in the XY plane *and* nudges further
 * along Z than the endpoints, so the ribbon arcs gently out of the line.
 */
function buildTube(start: THREE.Vector3, end: THREE.Vector3): THREE.TubeGeometry {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const planar = Math.hypot(dx, dy) || 1;

  const perpX = -dy / planar;
  const perpY = dx / planar;
  const bow = planar * 0.2;

  const mid = new THREE.Vector3(
    (start.x + end.x) / 2 + perpX * bow,
    (start.y + end.y) / 2 + perpY * bow,
    (start.z + end.z) / 2 + bow * 0.3
  );

  const curve = new THREE.QuadraticBezierCurve3(start.clone(), mid, end.clone());
  return new THREE.TubeGeometry(curve, 20, 0.05, 5, false);
}

/** All parent→child edges rendered as smooth 3D Bezier ribbon tubes. */
export function Connectors({ nodes, color, matches }: ConnectorsProps) {
  const edges = useMemo<EdgeData[]>(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const searchActive = (matches?.size ?? 0) > 0;
    const result: EdgeData[] = [];

    for (const node of nodes) {
      if (!node.parentId) continue;
      const parent = byId.get(node.parentId);
      if (!parent) continue;

      // An edge dims when search is active and neither endpoint is a match.
      const dimmed =
        searchActive && !matches!.has(node.id) && !matches!.has(parent.id);

      result.push({
        id: node.id,
        geometry: buildTube(
          new THREE.Vector3(parent.x, parent.y, parent.z),
          new THREE.Vector3(node.x, node.y, node.z)
        ),
        dimmed,
      });
    }

    return result;
  }, [nodes, matches]);

  return (
    <>
      {edges.map((edge) => (
        <mesh key={edge.id} geometry={edge.geometry}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={edge.dimmed ? 0.08 : 0.45}
          />
        </mesh>
      ))}
    </>
  );
}
