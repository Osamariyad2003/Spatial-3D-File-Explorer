import * as vscode from 'vscode';
import { FileExplorerViewProvider } from './FileExplorerViewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new FileExplorerViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      FileExplorerViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
}

export function deactivate(): void {
  // Disposables are released via context.subscriptions / view disposal.
}
