import { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import type { FileNode } from '../src/shared/types';
import { SphereNode } from './SphereNode';
import { Connectors } from './Connectors';
import { FitCamera } from './FitCamera';
import { useThemeColors, type ThemeColors } from './theme';
import { runForceLayout } from './forceLayout';

interface SceneProps {
  nodes: FileNode[];
  matches: Set<string>;
}

function colorForNode(node: FileNode, theme: ThemeColors): string {
  switch (node.fileKind) {
    case 'code':       return theme.code;
    case 'asset':      return theme.asset;
    case 'directory':  return theme.folder;
    case 'symlink':    return theme.symlink;
    case 'executable': return theme.executable;
    case 'deleted':    return theme.deleted;
    default:           return theme.code;
  }
}

/**
 * Renders the workspace as a 3D force-directed graph of colour-coded spheres
 * with curved tube connectors. While a search is active, non-matching nodes
 * fade out and matches glow.
 */
export function Scene({ nodes, matches }: SceneProps) {
  const theme = useThemeColors();
  const searchActive = matches.size > 0;

  const positioned = useMemo<FileNode[]>(() => {
    if (nodes.length === 0) return nodes;
    const positions = runForceLayout(nodes);
    return nodes.map((node) => {
      const p = positions.get(node.id);
      return p ? { ...node, x: p.x, y: p.y, z: p.z } : node;
    });
  }, [nodes]);

  return (
    <>
      <color attach="background" args={[theme.background]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[20, 30, 20]} intensity={0.85} />
      <pointLight position={[0, 0, 40]} intensity={0.5} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
      <FitCamera nodes={positioned} />
      <Connectors nodes={positioned} color={theme.link} matches={matches} />
      {positioned.map((node) => {
        const isMatch = matches.has(node.id);
        return (
          <SphereNode
            key={node.id}
            node={node}
            color={colorForNode(node, theme)}
            dimmed={searchActive && !isMatch}
            highlighted={searchActive && isMatch}
          />
        );
      })}
    </>
  );
}
