# VerseGuide.com Star Citizen Game Overlay 

Creates interactive transparent browser windows  inside the game window

## Requirements

- Visual Studio 2019 (C++ desktop workspace, winsdk 10.0.18362).
- Python 2 (`add to PATH`)

## Build

### Electron with node native-addons `electron-overlay` and `node-ovhook`

```bash
    cd client

    npm link ../electron-overlay
    npm link ../node-ovhook

    npm i (creates symlink only, breaks electron-forge make - make sure to manually copy electron-overlay and node-ovhook to node_modules!)
    npm run compile:electron

    npm run build
    npm run dev (develop)
    npm run make (windows zip/exe/msi with forge) 
```

### Recompile game-overlay dll

In default they are precompiled under `client/dist/overlay` but if you are making changes you might want to compile on your own

```bash
    cd game-overlay

    build.bat
```

copy files [`n_overlay.dll`, `n_overlay.x64.dll`, `n_ovhelper.exe`, `n_ovhelper.x64.exe`] from directory `game-overlay\bin\Release` to directory `client\dist\overlay`
