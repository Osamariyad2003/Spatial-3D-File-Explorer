import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import type { FileNode } from '../src/shared/types';

interface FitCameraProps {
  nodes: FileNode[];
}

interface OrbitLike {
  target?: { set(x: number, y: number, z: number): void };
  update?: () => void;
}

/**
 * Frames the whole 3D graph in the viewport — once. Picks a 3/4 perspective
 * angle so the layout reads as 3D from the first frame, and uses the bounding
 * sphere of the node set to choose distance. Re-fits only when the node set
 * goes from empty → non-empty; otherwise the user's orbit / zoom stick.
 */
export function FitCamera({ nodes }: FitCameraProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (nodes.length === 0) {
      // Reset the flag so the next non-empty scan re-frames.
      fittedRef.current = false;
      return;
    }
    if (fittedRef.current) return;
    if (size.width < 10 || size.height < 10) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x); maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y); maxY = Math.max(maxY, node.y);
      minZ = Math.min(minZ, node.z); maxZ = Math.max(maxZ, node.z);
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const w = maxX - minX;
    const h = maxY - minY;
    const d = maxZ - minZ;
    // Bounding-sphere radius — orientation-independent so any angle frames cleanly.
    const radius = Math.max(Math.sqrt(w * w + h * h + d * d) / 2, 6);

    const persp = camera as PerspectiveCamera;
    const fov = (persp.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(size.height, 1);
    // Narrow viewports need more distance so the width still fits.
    const halfFit = aspect < 1 ? radius / aspect : radius;
    const distance = halfFit / Math.tan(fov / 2) + 5;

    // Near-isometric tilt — depth is obvious from the first frame.
    const dx = 0.95;
    const dy = 1.0;
    const dz = 1;
    const dlen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    persp.position.set(
      centerX + (dx / dlen) * distance,
      centerY + (dy / dlen) * distance,
      centerZ + (dz / dlen) * distance
    );
    persp.lookAt(centerX, centerY, centerZ);
    persp.updateProjectionMatrix();

    const orbit = controls as OrbitLike | null;
    if (orbit?.target) {
      orbit.target.set(centerX, centerY, centerZ);
      orbit.update?.();
    }

    fittedRef.current = true;
  }, [nodes, size, camera, controls]);

  return null;
}
