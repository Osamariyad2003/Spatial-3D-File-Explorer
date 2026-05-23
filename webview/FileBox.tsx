import { useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { FileNode } from '../src/shared/types';
import { vscode } from './vscode-api';

interface FileBoxProps {
  node: FileNode;
  color: string;
}

function useInteraction(node: FileNode) {
  const [hovered, setHovered] = useState(false);
  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      setHovered(false);
      document.body.style.cursor = 'default';
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      vscode.postMessage({ type: 'openFile', fsPath: node.fsPath });
    },
  };
  return { hovered, handlers };
}

/** Code file — capsule whose height encodes line count, radius encodes import density. */
function CodeFile({ node, color }: FileBoxProps) {
  const { hovered, handlers } = useInteraction(node);
  const [radius, length] = useMemo(() => {
    const r = Math.min(0.65, 0.18 + node.importCount * 0.035);
    const l = Math.min(3.2,  0.45 + node.lineCount  * 0.004);
    return [Math.max(r, 0.18), Math.max(l, 0.45)];
  }, [node.lineCount, node.importCount]);

  return (
    <mesh position={[node.x, node.z, 0]} {...handlers}>
      {/* radius, length, capSegments, radialSegments */}
      <capsuleGeometry args={[radius, length, 4, 10]} />
      <meshStandardMaterial color={color} wireframe={hovered} roughness={0.45} metalness={0.2} />
    </mesh>
  );
}

/** Non-code asset — thin plate, width/depth proportional to file size. */
function AssetFile({ node, color }: FileBoxProps) {
  const { hovered, handlers } = useInteraction(node);
  const [w, d] = useMemo(() => {
    const side = Math.min(2.0, 0.5 + Math.cbrt(node.size + 1) * 0.28);
    return [side, side * 0.72];
  }, [node.size]);

  return (
    <mesh position={[node.x, node.z, 0]} {...handlers}>
      <boxGeometry args={[w, 0.13, d]} />
      <meshStandardMaterial color={color} wireframe={hovered} roughness={0.7} metalness={0.05} />
    </mesh>
  );
}

/** Symbolic link — small torus ring (hollow, points elsewhere). */
function SymlinkFile({ node, color }: FileBoxProps) {
  const { hovered, handlers } = useInteraction(node);
  const r = useMemo(() => Math.min(0.9, 0.3 + Math.cbrt(node.size + 1) * 0.12), [node.size]);
  return (
    <mesh position={[node.x, node.z, 0]} {...handlers}>
      <torusGeometry args={[r, r * 0.25, 8, 28]} />
      <meshStandardMaterial color={color} wireframe={hovered} roughness={0.4} metalness={0.3} />
    </mesh>
  );
}

/** Executable / script — cylinder pillar (data pipeline hub). */
function ExecutableFile({ node, color }: FileBoxProps) {
  const { hovered, handlers } = useInteraction(node);
  const h = useMemo(() => Math.min(2.8, 0.6 + Math.cbrt(node.size + 1) * 0.3), [node.size]);
  return (
    <mesh position={[node.x, node.z, 0]} {...handlers}>
      <cylinderGeometry args={[h * 0.25, h * 0.25, h, 14]} />
      <meshStandardMaterial color={color} wireframe={hovered} roughness={0.3} metalness={0.55} />
    </mesh>
  );
}

/** Deleted / broken symlink — octahedron wireframe (hazardous, unlinked). */
function DeletedFile({ node }: FileBoxProps) {
  const { hovered, handlers } = useInteraction(node);
  const r = useMemo(() => Math.min(1.4, 0.45 + Math.cbrt(node.size + 1) * 0.18), [node.size]);
  return (
    <mesh position={[node.x, node.z, 0]} {...handlers}>
      <octahedronGeometry args={[r]} />
      <meshStandardMaterial
        color="#f44747"
        wireframe
        roughness={0.9}
        opacity={hovered ? 1.0 : 0.65}
        transparent
      />
    </mesh>
  );
}

export function FileBox({ node, color }: FileBoxProps) {
  switch (node.fileKind) {
    case 'code':       return <CodeFile       node={node} color={color} />;
    case 'asset':      return <AssetFile      node={node} color={color} />;
    case 'symlink':    return <SymlinkFile    node={node} color={color} />;
    case 'executable': return <ExecutableFile node={node} color={color} />;
    case 'deleted':    return <DeletedFile    node={node} color={color} />;
    default:           return <AssetFile      node={node} color={color} />;
  }
}
