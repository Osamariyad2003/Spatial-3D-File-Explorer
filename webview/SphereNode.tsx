import { useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { FileNode } from '../src/shared/types';
import { vscode } from './vscode-api';

interface SphereNodeProps {
  node: FileNode;
  color: string;
  /** True when a search is active and this node is NOT a match. */
  dimmed?: boolean;
  /** True when a search is active and this node IS a match. */
  highlighted?: boolean;
}

function radiusFor(node: FileNode): number {
  if (node.isDirectory) {
    return Math.min(1.5, 0.55 + Math.log2(node.childCount + 1) * 0.18);
  }
  return Math.min(1.2, 0.4 + Math.cbrt(node.size + 1) * 0.11);
}

/**
 * One node in the graph — a sphere coloured by file kind with a name label
 * floating below. Click toggles a folder or opens a file. While a search is
 * active, non-matches fade out and matches glow + scale up.
 */
export function SphereNode({ node, color, dimmed, highlighted }: SphereNodeProps) {
  const [hovered, setHovered] = useState(false);
  const radius = useMemo(() => radiusFor(node), [node]);

  const onClick = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    if (node.isDirectory) {
      vscode.postMessage({ type: 'toggleExpand', fsPath: node.fsPath });
    } else {
      vscode.postMessage({ type: 'openFile', fsPath: node.fsPath });
    }
  };

  const baseScale = highlighted ? 1.3 : 1;
  const scale = hovered ? baseScale * 1.15 : baseScale;
  const emissiveIntensity = highlighted ? 0.9 : hovered ? 0.7 : dimmed ? 0.08 : 0.4;
  const opacity = dimmed ? 0.18 : 1;
  const labelOpacity = dimmed ? 0.25 : hovered || highlighted ? 1 : 0.78;

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh
        scale={scale}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
        onClick={onClick}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.35}
          metalness={0.1}
          transparent
          opacity={opacity}
        />
      </mesh>

      <Html
        position={[0, -(radius + 0.35), 0]}
        center
        distanceFactor={14}
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            fontFamily: 'var(--vscode-font-family)',
            fontSize: 11,
            color: 'var(--vscode-foreground)',
            opacity: labelOpacity,
            whiteSpace: 'nowrap',
            textShadow: '0 0 4px rgba(0,0,0,0.85)',
            userSelect: 'none',
            fontWeight: highlighted ? 700 : 400,
          }}
        >
          {node.name}
        </div>
      </Html>
    </group>
  );
}
