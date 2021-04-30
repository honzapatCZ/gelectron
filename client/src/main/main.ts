import { app as ElectronApp } from "electron"

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    // eslint-disable-line global-require
    ElectronApp.quit();
}

import "./utils/config"

import { Application } from "./electron/app-entry"

const appEntry = new Application()

//force windows scaling to disable
ElectronApp.setName('VerseGuide');
ElectronApp.setAppUserModelId('com.verseguide.overlay.verseguide.VerseGuide')
ElectronApp.commandLine.appendSwitch('high-dpi-support', '1')
ElectronApp.commandLine.appendSwitch('force-device-scale-factor', '1')

ElectronApp.disableHardwareAcceleration()

ElectronApp.on("ready", () => {

    // inportant for Google login (outdated browser error) - pretend Electron is Chrome
    ElectronApp.userAgentFallback = "Chrome";

    appEntry.start()
})

ElectronApp.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        ElectronApp.quit()
    }
})

ElectronApp.on("activate", () => {
    appEntry.activate()
})
