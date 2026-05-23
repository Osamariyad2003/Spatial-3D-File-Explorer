import { useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { FileNode } from '../src/shared/types';
import { vscode } from './vscode-api';

interface FolderIconProps {
  node: FileNode;
  color: string;
}

function torusParams(childCount: number): [number, number] {
  const outerR = Math.min(3.2, 0.7 + childCount * 0.22);
  const tubeR = Math.max(0.08, outerR * 0.11);
  return [outerR, tubeR];
}

/**
 * A directory ring. Clicking it toggles expand/collapse of its children — a
 * collapsed folder with hidden children shows a filled centre disc as a hint.
 * Text labels are intentionally omitted: drei's <Text> spawns a troika worker
 * + external font fetch, which is fragile under the webview's strict CSP.
 */
export function FolderIcon({ node, color }: FolderIconProps) {
  const [hovered, setHovered] = useState(false);
  const [outerR, tubeR] = useMemo(
    () => torusParams(node.childCount),
    [node.childCount]
  );
  const collapsed = !node.expanded && node.childCount > 0;

  const toggle = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    vscode.postMessage({ type: 'toggleExpand', fsPath: node.fsPath });
  };

  return (
    <group position={[node.x, node.z, 0]}>
      <mesh
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
        onClick={toggle}
      >
        <torusGeometry args={[outerR, tubeR, 6, 40]} />
        <meshStandardMaterial
          color={color}
          wireframe={hovered}
          roughness={0.4}
          metalness={0.35}
          opacity={hovered ? 1 : 0.88}
          transparent
        />
      </mesh>

      {/* Centre disc: visible only when collapsed, but always a click target. */}
      <mesh onClick={toggle}>
        <circleGeometry args={[outerR * 0.9, 28]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={collapsed ? 0.5 : 0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
