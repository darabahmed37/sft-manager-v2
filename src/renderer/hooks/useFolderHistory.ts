import { useState } from 'react';

export interface FolderHistory {
  history: string[];
  historyIdx: number;
  currentDir: string;
  changeDirectory: (dirPath: string, loadDirFn: (path: string) => Promise<void>, pushState?: boolean) => Promise<void>;
  goBack: (loadDirFn: (path: string) => Promise<void>) => void;
  goForward: (loadDirFn: (path: string) => Promise<void>) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  resetHistory: (dirPath: string) => void;
}

export function useFolderHistory(initialDir: string): FolderHistory {
  const [history, setHistory] = useState<string[]>(initialDir ? [initialDir] : []);
  const [historyIdx, setHistoryIdx] = useState(initialDir ? 0 : -1);
  const [currentDir, setCurrentDir] = useState(initialDir);

  const changeDirectory = async (
    dirPath: string,
    loadDirFn: (path: string) => Promise<void>,
    pushState = true
  ) => {
    await loadDirFn(dirPath);
    setCurrentDir(dirPath);
    if (pushState) {
      setHistory(prev => {
        const next = prev.slice(0, historyIdx + 1);
        next.push(dirPath);
        return next;
      });
      setHistoryIdx(prev => prev + 1);
    }
  };

  const goBack = (loadDirFn: (path: string) => Promise<void>) => {
    if (historyIdx > 0) {
      const prevIdx = historyIdx - 1;
      setHistoryIdx(prevIdx);
      setCurrentDir(history[prevIdx]);
      loadDirFn(history[prevIdx]);
    }
  };

  const goForward = (loadDirFn: (path: string) => Promise<void>) => {
    if (historyIdx < history.length - 1) {
      const nextIdx = historyIdx + 1;
      setHistoryIdx(nextIdx);
      setCurrentDir(history[nextIdx]);
      loadDirFn(history[nextIdx]);
    }
  };

  const resetHistory = (dirPath: string) => {
    setHistory([dirPath]);
    setHistoryIdx(0);
    setCurrentDir(dirPath);
  };

  return {
    history,
    historyIdx,
    currentDir,
    changeDirectory,
    goBack,
    goForward,
    canGoBack: historyIdx > 0,
    canGoForward: historyIdx < history.length - 1,
    resetHistory
  };
}
