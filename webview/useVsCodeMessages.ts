import { useEffect, useState } from 'react';
import type { ExtensionToWebview, FileNode } from '../src/shared/types';
import { vscode } from './vscode-api';

export interface ScanState {
  nodes: FileNode[];
  /** fsPaths of nodes matching the current search query (empty when none). */
  matches: Set<string>;
}

/**
 * Subscribes to the IPC bridge (SRS §3.2). Announces readiness on mount so the
 * extension sends the initial scan, then keeps state in sync with every
 * `scanResult` re-index (including search results — `matches` is the set of
 * fsPaths that the active search query hit).
 */
export function useScanData(): ScanState {
  const [state, setState] = useState<ScanState>({ nodes: [], matches: new Set() });

  useEffect(() => {
    function onMessage(event: MessageEvent<ExtensionToWebview>): void {
      const message = event.data;
      console.log('[Spatial3D] webview ← extension:', message);
      if (message && message.type === 'scanResult') {
        setState({
          nodes: message.nodes,
          matches: new Set(message.matches),
        });
      }
    }

    window.addEventListener('message', onMessage);
    console.log('[Spatial3D] webview mounted; posting ready');
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', onMessage);
  }, []);

  return state;
}
