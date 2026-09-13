export interface ElectronAPI {
  isElectron: boolean;
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  close: () => Promise<void>;
  onMaximizeChange: (callback: (isMax: boolean) => void) => () => void;
  showMessage: (options: any) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
