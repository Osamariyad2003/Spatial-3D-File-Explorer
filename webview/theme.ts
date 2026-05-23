import { useEffect, useState } from 'react';

export interface ThemeColors {
  background: string;
  code: string;
  asset: string;
  folder: string;
  symlink: string;
  executable: string;
  deleted: string;
  link: string;
}

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

export function readThemeColors(): ThemeColors {
  return {
    background: css('--vscode-editor-background',       '#1e1e1e'),
    code:       css('--vscode-charts-blue',             '#4f8fd1'),
    asset:      css('--vscode-charts-orange',           '#d4a04f'),
    folder:     css('--vscode-charts-yellow',           '#d1b14f'),
    symlink:    css('--vscode-charts-purple',           '#a855f7'),
    executable: css('--vscode-charts-green',            '#4ec94e'),
    deleted:    css('--vscode-errorForeground',         '#f44747'),
    link:       css('--vscode-descriptionForeground',   '#6a6a6a'),
  };
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(readThemeColors);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readThemeColors()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}
