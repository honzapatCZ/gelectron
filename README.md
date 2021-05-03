# VerseGuide.com Star Citizen Game Overlay 

Creates interactive transparent browser windows inside the game window

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
