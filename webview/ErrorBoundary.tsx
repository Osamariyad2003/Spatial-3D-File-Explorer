import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches React errors that would otherwise unmount the whole tree and leave
 * the webview blank — surfaces the message + stack as visible text instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = { error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Spatial3D] render error:', error, info.componentStack);
  }

  public render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: 12,
            color: '#f4a4a4',
            background: 'rgba(0,0,0,0.7)',
            fontFamily: 'var(--vscode-editor-font-family, monospace)',
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            overflow: 'auto',
            zIndex: 10,
          }}
        >
          <strong>Spatial 3D render error</strong>
          {'\n\n'}
          {this.state.error.message}
          {'\n\n'}
          {this.state.error.stack}
        </div>
      );
    }
    return this.props.children;
  }
}
