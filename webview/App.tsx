import { type CSSProperties, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { useScanData } from './useVsCodeMessages';
import { ErrorBoundary } from './ErrorBoundary';
import { useThemeColors, type ThemeColors } from './theme';
import { vscode } from './vscode-api';
import type { FileNode } from '../src/shared/types';

interface KindCounts {
  total: number;
  folders: number;
  code: number;
  asset: number;
  symlink: number;
  executable: number;
  deleted: number;
}

function countByKind(nodes: FileNode[]): KindCounts {
  const counts: KindCounts = {
    total: nodes.length,
    folders: 0,
    code: 0,
    asset: 0,
    symlink: 0,
    executable: 0,
    deleted: 0,
  };
  for (const node of nodes) {
    switch (node.fileKind) {
      case 'directory':  counts.folders += 1; break;
      case 'code':       counts.code += 1; break;
      case 'asset':      counts.asset += 1; break;
      case 'symlink':    counts.symlink += 1; break;
      case 'executable': counts.executable += 1; break;
      case 'deleted':    counts.deleted += 1; break;
    }
  }
  return counts;
}

const labelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  color: 'var(--vscode-descriptionForeground)',
  opacity: 0.7,
};

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '2px 6px', minWidth: 36 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={labelStyle}>{label}</div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--vscode-foreground)' }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
          display: 'inline-block',
        }}
      />
      <span>{label}</span>
    </div>
  );
}

interface SearchBarProps {
  query: string;
  matchCount: number;
  searchActive: boolean;
  onChange: (next: string) => void;
}

function SearchBar({ query, matchCount, searchActive, onChange }: SearchBarProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 4,
        padding: '4px 8px',
        gap: 6,
        pointerEvents: 'auto',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--vscode-descriptionForeground)',
          opacity: 0.7,
        }}
        aria-hidden
      >
        ⌕
      </span>
      <input
        type="text"
        value={query}
        placeholder="Search files & folders"
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--vscode-foreground)',
          fontFamily: 'var(--vscode-font-family)',
          fontSize: 12,
          minWidth: 0,
        }}
      />
      {searchActive && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--vscode-descriptionForeground)',
            opacity: 0.75,
            whiteSpace: 'nowrap',
          }}
        >
          {matchCount} hit{matchCount === 1 ? '' : 's'}
        </span>
      )}
      {query && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--vscode-descriptionForeground)',
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function Chrome({
  nodes,
  theme,
  query,
  matchCount,
  searchActive,
  onQueryChange,
}: {
  nodes: FileNode[];
  theme: ThemeColors;
  query: string;
  matchCount: number;
  searchActive: boolean;
  onQueryChange: (next: string) => void;
}) {
  const counts = countByKind(nodes);
  const root = nodes.find((node) => node.parentId === null);
  const title = root?.name ?? 'No workspace';

  return (
    <>
      {/* Top row: title + search left, stats right (wraps on narrow widths). */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 14,
          right: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          pointerEvents: 'none',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 auto', maxWidth: 260 }}>
          <div style={labelStyle}>Repo Map</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--vscode-foreground)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          <div style={{ marginTop: 8 }}>
            <SearchBar
              query={query}
              matchCount={matchCount}
              searchActive={searchActive}
              onChange={onQueryChange}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 2 }}>
          <Stat value={counts.total} label="Nodes" color={'var(--vscode-foreground)'} />
          {counts.folders > 0 && <Stat value={counts.folders} label="Folders" color={theme.folder} />}
          {counts.code > 0 && <Stat value={counts.code} label="Code" color={theme.code} />}
          {counts.asset > 0 && <Stat value={counts.asset} label="Assets" color={theme.asset} />}
          {counts.executable > 0 && <Stat value={counts.executable} label="Exec" color={theme.executable} />}
          {counts.symlink > 0 && <Stat value={counts.symlink} label="Link" color={theme.symlink} />}
          {counts.deleted > 0 && <Stat value={counts.deleted} label="Missing" color={theme.deleted} />}
        </div>
      </div>

      {/* Bottom-left legend. */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 14,
          padding: '8px 10px',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          pointerEvents: 'none',
          backdropFilter: 'blur(2px)',
        }}
      >
        <div style={{ ...labelStyle, marginBottom: 2 }}>Legend</div>
        <LegendItem color={theme.folder} label="Folder" />
        <LegendItem color={theme.code} label="Code" />
        <LegendItem color={theme.asset} label="Asset" />
        <LegendItem color={theme.executable} label="Executable" />
        <LegendItem color={theme.symlink} label="Symlink" />
        <LegendItem color={theme.deleted} label="Missing" />
      </div>

      {/* Bottom-right interaction hint. */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          right: 14,
          fontSize: 10,
          color: 'var(--vscode-descriptionForeground)',
          opacity: 0.6,
          pointerEvents: 'none',
          letterSpacing: 0.5,
        }}
      >
        drag · scroll zoom · click node
      </div>
    </>
  );
}

export function App() {
  const { nodes, matches } = useScanData();
  const theme = useThemeColors();
  const [query, setQuery] = useState('');
  const searchActive = query.trim() !== '';

  // Debounced post: send the latest query 150ms after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      vscode.postMessage({ type: 'search', query });
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ErrorBoundary>
        <Canvas
          camera={{ position: [0, 0, 60], fov: 50, near: 0.1, far: 2000 }}
          dpr={[1, 2]}
        >
          <Scene nodes={nodes} matches={matches} />
        </Canvas>
      </ErrorBoundary>

      <Chrome
        nodes={nodes}
        theme={theme}
        query={query}
        matchCount={matches.size}
        searchActive={searchActive}
        onQueryChange={setQuery}
      />

      {nodes.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--vscode-descriptionForeground)',
            fontFamily: 'var(--vscode-font-family)',
            fontSize: 'var(--vscode-font-size)',
            pointerEvents: 'none',
          }}
        >
          No workspace files to display.
        </div>
      )}
    </div>
  );
}
