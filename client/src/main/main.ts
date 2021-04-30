import { app as ElectronApp } from 'electron';

import './utils/config';

import { Application } from './electron/app-entry';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  ElectronApp.quit();
}

const appEntry = new Application();

// force windows scaling to disable
ElectronApp.setName('VerseGuide');
ElectronApp.setAppUserModelId('com.verseguide.overlay.verseguide.VerseGuide');
ElectronApp.commandLine.appendSwitch('high-dpi-support', '1');
ElectronApp.commandLine.appendSwitch('force-device-scale-factor', '1');

ElectronApp.disableHardwareAcceleration();

ElectronApp.on('ready', () => {
  // important for Google login (outdated browser error) - pretend Electron is Chrome (which it is!)
  ElectronApp.userAgentFallback = 'Chrome';

  appEntry.start();
});

ElectronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    ElectronApp.quit();
  }
});

ElectronApp.on('activate', () => {
  appEntry.activate();
});
