import type { WebviewToExtension } from '../src/shared/types';

interface VsCodeApi {
  postMessage(message: WebviewToExtension): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}

/** `acquireVsCodeApi` may only be called once per webview load. */
export const vscode = acquireVsCodeApi();
