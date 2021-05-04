# VerseGuide.com Star Citizen Game Overlay 

Creates interactive transparent browser windows inside the game window

## Installation

We offer two ways to use VerseGuide Overlay:

- portable archive (zip)
- installer (exe)

Both can be downloaded at https://github.com/gulbrillo/VerseGuide-overlay/releases/latest

The zip archive (`VerseGuide-win32-x64-X.X.X.zip`) contains all files necessary for the the overlay. Just unpack it into a folder of your choice and run `VerseGuide.exe`. This is not an installer and does not create any Desktop shortcuts. In oder to remove the app, just delete the folder.

The installer (`VerseGuide-X.X.X.Setup.exe`) does install the app into your Windows user folder and creates a Desktop shortcut in your Start Menu. This version of the app does come with an auto-update feature. You can right-click the Start Menu shortcut in order to uninstall the app. 

## Warning Messages

This app is open source and digitally signed. However, since we are a small developer team, we don't have any reputation with developers of anti-virus software. Hence you might see messages warning you that VerseGuide Overlay might be harmful to your PC. We can assure you it is not. But: if you don't trust us, don't use our apps. 

#### Windows Defender Warning

The installer may throw a Windows Defender SmartScreen `unrecognized app` warning. This is because the app is new (unknown to Windows).
Thanks to the generosity of Citizen Kevlar099 we were able to purchase a `OV Code Signing Certificate` (identity verification) and all our installers are signed by one of our developers (Simon F Barke). This way we will slowly build reputation as files are downloaded. Over time, Windows Defender will start trusting us. 🤞 

#### Virus Scanner Malware/Adware Warning

These are fair warnings. VerseGuide Overlay does what sophisticated Malware or Adware would do: we monitor the launch of Windows processes (StarCitizen.exe) and inject interactive elements (our sunrise/sunset calculator). Virus scanners will have a hard time discerning between a sunrise/sunset calculator in Star Citizen and some scam advertisement in Word. They may detect pattern in our app that is very similar to known Malware or Adware and warn you of the potential risks. We are in the process of submitting our app to different Virus Scanner Portals for analysis and white listing.  

## Made by the Community

This is an unofficial Star Citizen project, not affiliated with the Cloud Imperium group of companies. All content within this project not authored by its developer or users are property of their respective owners.
                          
The overlay includes multiple tools developed by the VerseGuide team including Citizens Pitapa, justMurphy, xabdiben, Graupunkt, StoicMako and LordSkippy.
It watches Windows processes and tries to inject overlay elements into Star Citizen via DirectX upon launch. It registers hotkeys and simulates keyboard input to execute a command in Global Chat that allows us to retrieve location information via the Windows clipboard.

## Requirements

- Node 12.X.X
- Electron 11.X.X
- Visual Studio 2019 (C++ desktop workspace, winsdk 10.0.x).
- Python 2 (`add to PATH`)

## Build

### Electron with node native-addons `electron-overlay` and `node-ovhook`

```bash
    cd client

    npm link ../electron-overlay (if this fails, try manually deleting /electron-overlay/node_modules/.bin
    npm link ../node-ovhook

    npm i (creates symlink only, breaks electron-forge make - make sure to manually copy /electron-overlay and /node-ovhook to /client/node_modules!)
    npm run compile:electron

    npm run build

    npm run dev (develop)
    npm run make (windows zip/exe/msi with forge - output in /client/out/) 
    npm run publish (build and upload all make targets to GitHub as draft release)
```

If iohook does complain (not a valid win32 application) something went wrong with the pre-build binary downloads of the iohook node module.
I had to copy the electron/v85 and node-v72 folders from another project (ioook 0.9.0) into `client/node-modules/iohook/builds/` (overwrite the downloaded files).
Hopefully this will be fixed on iohooks end by the time you try to compile this.  

### Recompile game-overlay dll

They are precompiled under `client/dist/overlay` but if you are making changes you might want to compile on your own

```bash
    cd game-overlay

    build.bat
```

copy files [`n_overlay.dll`, `n_overlay.x64.dll`, `n_ovhelper.exe`, `n_ovhelper.x64.exe`] from directory `game-overlay/bin/Release` to directory `client/dist/overlay`
