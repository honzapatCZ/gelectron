import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  clipboard,
  screen,
  shell,
  ipcRenderer,
} from 'electron';

// import * as fs from 'fs';
import * as path from 'path';

import * as IOverlay from 'electron-overlay';

import * as IOVhook from 'node-ovhook';

/// ////////////////////////////////////////////////////////
// keypress simulator
import keycode from 'keycode';
import ffi from 'ffi-napi';
import ref from 'ref-napi';
import os from 'os';
import import_Struct from 'ref-struct-di';

import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

import {
  fileUrl,
} from '../utils/utils';
import CONFIG from '../utils/config';

const {
  setVibrancy,
} = require('electron-acrylic-window');

const ntpsync = require('ntpsync');

const firebaseConfig = {
  apiKey: global.FBAPI,
  authDomain: 'verseguide.firebaseapp.com',
  databaseURL: 'https://verseguide.firebaseio.com',
  projectId: 'verseguide',
  storageBucket: 'verseguide.appspot.com',
  appId: '1:138686445127:web:522f8e0e94552a3f2e6362',
};

firebase.initializeApp(firebaseConfig);
// firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL) //does not work with Electron

const db = firebase.firestore();

const Store = require('electron-store');

const store = new Store();

// Read userJson from disk and log in

const storedUser = store.get('user');

if (storedUser) {
  try {
    const userData = JSON.parse(storedUser);

    const user: firebase.User = new (firebase as any).User(userData, userData.stsTokenManager, userData);
    firebase.auth().updateCurrentUser(user)
      .then(() => {
        console.log('user updated');
      })
      .catch((error) => {
        console.log(error);
        // Set userJson on disk to null
        store.set('user', null);

        firebase.auth().signOut().then(() => {
          console.log('signed out');
        }).catch((error2) => {
          console.log(error2);
        });
      });
  } catch (e) {
    console.log(e);
  }
}

console.log();

const clipboardListener = require('clipboard-event'); // clipboard change event: https://www.npmjs.com/package/clipboard-event

const arch = os.arch();
const Struct = import_Struct(ref);

const Input = Struct({
  type: 'int',

  // For some reason, the wScan value is only recognized as the wScan value when we add this filler slot.
  // It might be because it's expecting the values after this to be inside a "wrapper" substructure, as seen here:
  //     https://msdn.microsoft.com/en-us/library/windows/desktop/ms646270(v=vs.85).aspx
  '???': 'int',

  wVK: 'short',
  wScan: 'short',
  dwFlags: 'int',
  time: 'int',
  dwExtraInfo: 'int64',
});

const stringPtr = ref.refType(ref.types.CString);

const user32 = ffi.Library('user32', {
  SendInput: ['int', ['int', Input, 'int']],
  MapVirtualKeyW: ['uint', ['uint', 'uint']],
  GetForegroundWindow: ['long', []],
  GetWindowTextA: ['long', ['long', stringPtr, 'long']],
});

const extendedKeyPrefix = 0xe000;
const INPUT_KEYBOARD = 1;
const KEYEVENTF_EXTENDEDKEY = 0x0001;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;
const KEYEVENTF_SCANCODE = 0x0008;
// const MAPVK_VK_TO_VSC = 0;

export class KeyToggle_Options {
  asScanCode = false;

  keyCodeIsScanCode = false;

  asKeyStroke = false;

  flags ? : number;

  async = false; // async can reduce stutter in your app, if frequently sending key-events
}

const entry = new Input(); // having one persistent native object, and just changing its fields, is apparently faster (from testing)
entry.type = INPUT_KEYBOARD;
entry.time = 0;
entry.dwExtraInfo = 0;
export function KeyToggle(keyCode: any, type = 'down' as 'down' | 'up', options?: Partial<KeyToggle_Options>) {
  const opt = {
    ...new KeyToggle_Options(),
    ...options,
  };

  // scan-code approach (default)
  if (opt.asScanCode) {
    const scanCode = opt.keyCodeIsScanCode ? keyCode : user32.MapVirtualKeyW(keyCode, 0); // this should work, but it had a Win32 error (code 127) for me
    // let scanCode = opt.keyCodeIsScanCode ? keyCode : ConvertKeyCodeToScanCode(keyCode);
    const isExtendedKey = (scanCode & extendedKeyPrefix) === extendedKeyPrefix;

    entry.dwFlags = KEYEVENTF_SCANCODE;
    if (isExtendedKey) {
      entry.dwFlags |= KEYEVENTF_EXTENDEDKEY;
    }

    entry.wVK = 0;
    entry.wScan = isExtendedKey ? scanCode - extendedKeyPrefix : scanCode;
  } else if (opt.asKeyStroke) {
    entry.dwFlags = KEYEVENTF_UNICODE;
    entry.wVK = 0;
    entry.wScan = keyCode.charCodeAt(0);
  }
  // (virtual) key-code approach
  else {
    entry.dwFlags = 0;
    entry.wVK = keyCode;
    // info.wScan = 0x0200;
    entry.wScan = 0;
  }

  if (opt.flags != null) {
    entry.dwFlags = opt.flags;
  }
  if (type === 'up') {
    entry.dwFlags |= KEYEVENTF_KEYUP;
  }

  if (opt.async) {
    return new Promise((resolve, reject) => {
      user32.SendInput.async(1, entry, arch === 'x64' ? 40 : 28, (error, result) => {
        if (error) reject(error);
        resolve(result);
      });
    });
  }
  return user32.SendInput(1, entry, arch === 'x64' ? 40 : 28);
}

export function KeyTap(keyCode: any, opt ? : Partial < KeyToggle_Options >) {
  KeyToggle(keyCode, 'down', opt);
  KeyToggle(keyCode, 'up', opt);
}

// Scan-code for a char equals its index in this list. List based on: https://qb64.org/wiki/Scancodes, https://www.qbasic.net/en/reference/general/scan-codes.htm
// Not all keys are in this list, of course. You can add a custom mapping for other keys to the function below it, as needed.
const keys = "**1234567890-=**qwertyuiop[]**asdfghjkl;'`*\\zxcvbnm,./".split('');

export function ConvertKeyCodeToScanCode(keyCode: number) {
  const keyChar = String.fromCharCode(keyCode).toLowerCase();
  const result = keys.indexOf(keyChar);
  console.assert(result !== -1, `Could not find scan-code for key ${keyCode} (${keycode.names[keyCode]}).`);
  return result;
}

//
/// ////////////////////////////////////////////////////////

let toggleCounter = false;
let toggleHide = false;
let toggleFPS = true;
// counter for auto keypress injection
let counter = 5; // start counter (5 seconds)
const counterReset = 60; // min counter value for auto update (1 minute)
let flag = 'disabled';
let timeDelta = 0;

enum AppWindows {
  main = 'main',
  osr = 'osr',
  osrpopup = 'osrpopup',
  splash = 'splashSCreen'
}

class Application {
  private windows: Map < string, Electron.BrowserWindow >

  private tray: Electron.Tray | null

  private markQuit = false

  private Overlay: typeof IOverlay

  private OvHook: typeof IOVhook

  private Dimensions = {
    width: 1920,
    height: 1080,
  }

  constructor() {
    this.windows = new Map();
    this.tray = null;
  }

  get mainWindow() {
    return this.windows.get(AppWindows.main) || null;
  }

  set mainWindow(window: Electron.BrowserWindow | null) {
    if (!window) {
      this.windows.delete(AppWindows.main);
    } else {
      this.windows.set(AppWindows.main, window);
      window.on('closed', () => {
        this.mainWindow = null;
      });

      window.loadURL(global.CONFIG.entryUrl);

      window.on('ready-to-show', () => {
        this.showAndFocusWindow(AppWindows.main);
      });

      window.webContents.on('did-fail-load', () => {
        window.reload();
      });

      window.on('close', (event) => {
        if (this.markQuit) {
          return;
        }
        event.preventDefault();
        window.hide();
        return false;
      });

      if (global.DEBUG) {
        window.webContents.openDevTools();
      }
    }
  }

  public syncNTPtime() {
    ntpsync.ntpLocalClockDeltaPromise().then((iNTPData) => {
      timeDelta = iNTPData.minimalNTPLatencyDelta;
      console.log(`(Local Time - NTP Time) Delta = ${iNTPData.minimalNTPLatencyDelta} ms`);
      console.log(`Minimal Ping Latency was ${iNTPData.minimalNTPLatency} ms`);
      console.log(`Total ${iNTPData.totalSampleCount} successful NTP Pings`);
    }).catch((err) => {
      console.log(err);
    });
  }

  public getWindow(window: string) {
    return this.windows.get(window) || null;
  }

  public listenToUser() {
    const self = this;

    firebase.auth().onAuthStateChanged((user) => {
      const window = self.getWindow(AppWindows.main);

      if (user && user.uid) {
        console.log('USER CHANGE', user.uid);

        const docRef = db.collection('users').doc(user.uid);

        docRef.get().then((doc) => {
          if (doc.exists) {
            console.log('Document data:', doc.data());

            if (window) {
              window.webContents.send('user', doc.data());
            }
          } else {
            // doc.data() will be undefined in this case
            console.log('No such document!');

            if (window) {
              window.webContents.send('user', null);
              window.webContents.send('error', 'profile not found');
            }
          }
        }).catch((error) => {
          console.log('Error getting document:', error);

          if (window) {
            window.webContents.send('user', null);
            if (error && error.message) {
              window.webContents.send('error', error.message);
            } else if (error && error.code) {
              window.webContents.send('error', error.code);
            }
          }
        });
      } else {
        console.log('logged out');

        if (window) {
          window.webContents.send('user', null);
          window.webContents.send('error', 'you have been signed out');
        }
      }
    });
  }

  public listenToClipboard() {
    // To start listening
    clipboardListener.startListening();

    // get clipboard content on change
    clipboardListener.on('change', () => {
      const timestamp = Date.now() - timeDelta;
      const coordinates = clipboard.readText();

      console.log(timestamp, coordinates);

      const window = this.getWindow('Location');
      if (window) {
        window.webContents.send('clipboard', {
          timestamp,
          coordinates,
        });
      }
    });
  }

  public showLocation() {
    const self = this;

    /// ////////////////////////////////////////////////////////
    // keypress listener (add a 1 second timeout to the counter if a key is pressed, exclude auto events at counter = 0)
    const ioHook = require('iohook');

    ioHook.on('keydown', (event) => {
      // console.log(event);
      if (event.type === 'keydown' && counter !== 0) {
        if (counter < 5) {
          counter = 5;
          if (flag === 'enabled') {
            flag = 'paused';
          }
        }
        const window = self.getWindow('StatusBar');
        if (window) {
          window.webContents.send('keysim', {
            counter,
            flag,
          });
        }
      }
    });

    // Register and start hook
    ioHook.start();

    //
    /// ////////////////////////////////////////////////////////

    setInterval(() => {
      // console.log('foreground window', user32.GetForegroundWindow())
      let buf;
      let name;
      let
        ret;
      buf = new Buffer(255);
      ret = user32.GetWindowTextA(user32.GetForegroundWindow(), buf, 255);
      name = ref.readCString(buf, 0);

      // if Star Citizen is not active top window
      if (!toggleCounter) {
        flag = 'disabled';
        counter = 5;
      } else if (name !== 'Star Citizen') {
        flag = 'stopped';
      } else {
        flag = 'enabled';
        counter--;
      }

      // send counter to statusbar
      const window = self.getWindow('StatusBar');
      if (window) {
        window.webContents.send('keysim', {
          counter,
          flag,
        });
      }

      // if (name === 'Star Citizen' && self.windows.get('Clipboard')) {
      if (name === 'Star Citizen') {
        if (counter === 0) {
          KeyTap(13, {
            asScanCode: true,
          }); // 'enter' (in game)

          setTimeout(() => {
            KeyTap('/', {
              asKeyStroke: true,
            }); // '/' (forward slash)
            KeyTap('s', {
              asKeyStroke: true,
            });
            KeyTap('h', {
              asKeyStroke: true,
            });
            KeyTap('o', {
              asKeyStroke: true,
            });
            KeyTap('w', {
              asKeyStroke: true,
            });
            KeyTap('l', {
              asKeyStroke: true,
            });
            KeyTap('o', {
              asKeyStroke: true,
            });
            KeyTap('c', {
              asKeyStroke: true,
            });
            KeyTap('a', {
              asKeyStroke: true,
            });
            KeyTap('t', {
              asKeyStroke: true,
            });
            KeyTap('i', {
              asKeyStroke: true,
            });
            KeyTap('o', {
              asKeyStroke: true,
            });
            KeyTap('n', {
              asKeyStroke: true,
            });
          }, 100); // delay needed after chat activation

          setTimeout(() => {
            KeyTap(13, {
              asScanCode: true,
            }); // 'enter' (in chat)
          }, 200); // delay needed after typing to send chat

          setTimeout(() => {
            counter = counterReset; // counter one above max value
          }, 250); // delay counter reset but 50ms after last keypress
        }
      } else {
        // set counter to one above max value
        counter = counterReset;
      }
    }, 1000);
  }

  public createSplashScreen() {
    const options: Electron.BrowserWindowConstructorOptions = {
      height: 810,
      width: 610,
      show: false,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
      },
    };

    const window = this.createWindow(AppWindows.splash, options);

    window.loadURL(fileUrl(path.join(global.CONFIG.distDir, 'index/splashpage.html')));
    // window.loadURL('https://www.verseguide.com')

    return window;
  }

  showSplashScreen() {
    const window = this.windows.get(AppWindows.splash);
    if (window) {
      window.show();
    }
  }

  hideSplashScreen() {
    const window = this.windows.get(AppWindows.splash);
    if (window) {
      window.hide();
    }
  }

  public createMainWindow() {
    const options: Electron.BrowserWindowConstructorOptions = {
      width: 600,
      height: 850,
      frame: false,
      show: false,
      transparent: false,
      resizable: false,
      fullscreen: false,
      maximizable: false,
      webPreferences: {
        nodeIntegration: true,
      },
    };
    const mainWindow = this.createWindow(AppWindows.main, options);
    setVibrancy(mainWindow);
    this.mainWindow = mainWindow;
    return mainWindow;
  }

  public openMainWindow() {
    let {
      mainWindow,
    } = this;
    if (!mainWindow) {
      mainWindow = this.createMainWindow();
    }
    mainWindow!.show();
    mainWindow!.focus();
  }

  public closeMainWindow() {
    const {
      mainWindow,
    } = this;
    if (mainWindow) {
      mainWindow.close();
    }
  }

  public startOverlay() {
    this.Overlay = require('electron-overlay');
    this.Overlay!.start();
    this.Overlay!.setHotkeys([{
      name: 'hide.toggle',
      keyCode: 188,
      modifiers: {
        alt: true,
      },
    }, // Alt+[,] hide overlay
    {
      name: 'overlay.toggle',
      keyCode: 190,
      modifiers: {
        alt: true,
      },
    }, // Alt+[.] show settings
    {
      name: 'hide.toggleAlt',
      keyCode: 188,
      modifiers: {
        alt: true,
        ctrl: true,
      },
    }, // AltGr+[,] hide overlay (Alt-Gr alternative)
    {
      name: 'overlay.toggleAlt',
      keyCode: 190,
      modifiers: {
        alt: true,
        ctrl: true,
      },
    }, // AltGr+[.] show settings (Alt-Gr alternative)
    ]);

    /*
    replace polling every second with clipboard-event
    //read clipboard every 1 seconds
    const self = this

    let intervalId = setInterval(function(){
      //decide to which window the data should be snet
      const window = self.windows.get("StatusBar") || null
      if (window) {
        window.webContents.send("clipboard", clipboard.readText())
      }
    }, 1000);
     */

    /*
    // To start listening
    clipboardListener.startListening();

    //get clipboard content on change
    clipboardListener.on('change', () => {
      let clipboardContent = clipboard.readText();
      const window = this.windows.get("StatusBar") || null
      if (window) {
        window.webContents.send("clipboard", clipboardContent)
      }
      console.log('Clipboard changed', clipboardContent);
    });
     */

    this.Overlay!.setEventCallback((event: string, payload: any) => {
      if (event === 'graphics.window' || event === 'graphics.window.event.resize') {
        if (payload && payload.width && payload.height) {
          this.Dimensions = payload;
        }
        console.log(this.Dimensions.width, this.Dimensions.height);

        const window = this.getWindow('Location');
        if (window) {
          window.setPosition(this.Dimensions.width - 300 - 15, 15);
        }
      }

      if (event === 'game.input') {
        const window = BrowserWindow.fromId(payload.windowId);
        if (window) {
          const intpuEvent = this.Overlay!.translateInputEvent(payload);
          // if (payload.msg !== 512) {
          //   console.log(event, payload)
          //   console.log(`translate ${JSON.stringify(intpuEvent)}`)
          // }

          if (intpuEvent) {
            window.webContents.sendInputEvent(intpuEvent);
          }
        }
      } else if (event === 'graphics.fps') {
        const window = this.getWindow('StatusBar');
        if (window) {
          window.webContents.send('fps', payload.fps);
        }
      } else if (event === 'game.hotkey.down') {
        if (payload.name === 'app.doit') {
          this.doit();
        } else if (payload.name === 'app.clipboard') {
          this.appClipboard();
        } else if (payload.name === 'hide.toggle' || payload.name === 'hide.toggleAlt') {
          toggleHide = !toggleHide;

          const window = this.getWindow(AppWindows.osr);
          if (window) {
            window.webContents.send('hideToggle');
          }
        }
      } else if (event === 'game.window.focused') {
        console.log('focusWindowId', payload.focusWindowId);

        BrowserWindow.getAllWindows().forEach((window) => {
          window.blurWebView();
        });

        const focusWin = BrowserWindow.fromId(payload.focusWindowId);
        if (focusWin) {
          focusWin.focusOnWebView();
        }
      }
    });
  }

  public addOverlayWindow(
    name: string,
    window: Electron.BrowserWindow,
    dragborder: number = 0,
    captionHeight: number = 0,
    transparent: boolean = false,
    alwaysOnTop: boolean = false,
    alwaysIgnoreInput: boolean = false,
  ) {
    const display = screen.getDisplayNearestPoint(
      screen.getCursorScreenPoint(),
    );

    this.Overlay!.addWindow(window.id, {
      name,
      transparent,
      resizable: window.isResizable(),
      maxWidth: window.isResizable
        ? display.bounds.width
        : window.getBounds().width,
      maxHeight: window.isResizable
        ? display.bounds.height
        : window.getBounds().height,
      minWidth: window.isResizable ? 100 : window.getBounds().width,
      minHeight: window.isResizable ? 100 : window.getBounds().height,
      nativeHandle: window.getNativeWindowHandle().readUInt32LE(0),
      rect: {
        ...window.getBounds(),
      },
      caption: {
        left: dragborder,
        right: dragborder,
        top: dragborder,
        height: captionHeight,
      },
      dragBorderWidth: dragborder,
      alwaysIgnoreInput,
      alwaysOnTop,
    });

    window.webContents.on(
      'paint',
      (event, dirty, image: Electron.NativeImage) => {
        if (this.markQuit) {
          return;
        }
          this.Overlay!.sendFrameBuffer(
            window.id,
            image.getBitmap(),
            image.getSize().width,
            image.getSize().height,
          );
      },
    );

    window.on('ready-to-show', () => {
      window.focusOnWebView();
    });

    window.on('resize', () => {
      this.Overlay!.sendWindowBounds(window.id, {
        rect: window.getBounds(),
      });
    });

    window.on('move', () => {
      this.Overlay!.sendWindowBounds(window.id, {
        rect: window.getBounds(),
      });
    });

    const windowId = window.id;
    window.on('closed', () => {
      this.Overlay!.closeWindow(windowId);
    });

    window.webContents.on('cursor-changed', (event, type) => {
      let cursor;
      switch (type) {
        case 'default':
          cursor = 'IDC_ARROW';
          break;
        case 'pointer':
          cursor = 'IDC_HAND';
          break;
        case 'crosshair':
          cursor = 'IDC_CROSS';
          break;
        case 'text':
          cursor = 'IDC_IBEAM';
          break;
        case 'wait':
          cursor = 'IDC_WAIT';
          break;
        case 'help':
          cursor = 'IDC_HELP';
          break;
        case 'move':
          cursor = 'IDC_SIZEALL';
          break;
        case 'nwse-resize':
          cursor = 'IDC_SIZENWSE';
          break;
        case 'nesw-resize':
          cursor = 'IDC_SIZENESW';
          break;
        case 'ns-resize':
          cursor = 'IDC_SIZENS';
          break;
        case 'ew-resize':
          cursor = 'IDC_SIZEWE';
          break;
        case 'none':
          cursor = '';
          break;
      }
      if (cursor) {
        this.Overlay!.sendCommand({
          command: 'cursor',
          cursor,
        });
      }
    });
  }

  public createOsrWindow() {
    const options: Electron.BrowserWindowConstructorOptions = {
      height: 600,
      width: 500,
      frame: false,
      show: false,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        offscreen: true,
      },
    };

    const window = this.createWindow(AppWindows.osr, options);

    window.setPosition(200, 200);
    // window.webContents.openDevTools({
    //   mode: "detach"
    // })
    window.loadURL(fileUrl(path.join(global.CONFIG.distDir, 'index/osr.html')));
    // window.loadURL('https://www.verseguide.com')

    this.addOverlayWindow('MainOverlay', window, 0, 0);
    return window;
  }

  public createLocationWindow() {
    const options: Electron.BrowserWindowConstructorOptions = {
      height: 500,
      width: 300,
      frame: false,
      show: false,
      transparent: true,
      resizable: false,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: true,
        offscreen: true,
      },
    };

    const name = 'Location';
    const window = this.createWindow(name, options);

    window.setPosition(this.Dimensions.width - 300 - 15, 15);

    // window.webContents.openDevTools({
    //   mode: "detach"
    // })
    window.loadURL(
      fileUrl(path.join(global.CONFIG.distDir, 'index/location.html')),
    );

    this.addOverlayWindow(name, window, 0, 0, true, true);
    return window;
  }

  public createOsrStatusbarWindow() {
    const options: Electron.BrowserWindowConstructorOptions = {
      height: 63,
      width: 400,
      frame: false,
      show: false,
      transparent: true,
      resizable: false,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: true,
        offscreen: true,
      },
    };

    const name = 'StatusBar';
    const window = this.createWindow(name, options);

    window.setPosition(15, 0);
    // window.webContents.openDevTools({
    //   mode: "detach"
    // })
    window.loadURL(
      fileUrl(path.join(global.CONFIG.distDir, 'index/statusbar.html')),
    );

    // this makes this particular overlay show as preview in the companion app
    window.webContents.on(
      'paint',
      (event, dirty, image: Electron.NativeImage) => {
        if (this.markQuit) {
          return;
        }
          this.mainWindow!.webContents.send('osrImage', {
            image: image.toDataURL(),
          });
      },
    );

    this.addOverlayWindow(name, window, 0, 0, true, true);
    return window;
  }

  public createOsrTipWindow() {
    const options: Electron.BrowserWindowConstructorOptions = {
      height: 220,
      width: 320,
      resizable: false,
      frame: false,
      show: false,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        offscreen: true,
      },
    };

    const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const name = `osrtip ${getRandomInt(1, 10000)}`;
    const window = this.createWindow(name, options);

    window.setPosition(0, 0);
    // window.webContents.openDevTools({
    //   mode: "detach"
    // })
    window.loadURL(
      fileUrl(path.join(global.CONFIG.distDir, 'index/osrtip.html')),
    );

    this.addOverlayWindow(name, window, 30, 40, true);
    return window;
  }

  public closeAllWindows() {
    const windows = this.windows.values();
    for (const window of windows) {
      window.close();
    }
  }

  public closeWindow(name: string) {
    const window = this.windows.get(name);
    if (window) {
      window.close();
      return true;
    }
    return false;
  }

  public hideWindow(name: string) {
    const window = this.windows.get(name);
    if (window) {
      window.hide();
    }
  }

  public showAndFocusWindow(name: string) {
    const window = this.windows.get(name);
    if (window) {
      window.show();
      window.focus();
    }
  }

  public setupSystemTray() {
    if (!this.tray) {
      this.tray = new Tray(
        path.join(global.CONFIG.distDir, 'assets/icon-16.png'),
      );
      const contextMenu = Menu.buildFromTemplate([{
        label: 'Open',
        click: () => {
          this.showAndFocusWindow(AppWindows.main);
        },
      },
      {
        label: 'Minimize',
        click: () => {
          this.hideWindow(AppWindows.main);
        },
      },
      {
        label: 'Exit',
        click: () => {
          this.quit();
        },
      },
      ]);
      this.tray.setToolTip('VerseGuide');
      this.tray.setContextMenu(contextMenu);

      this.tray.on('click', () => {
        this.showAndFocusWindow(AppWindows.main);
      });
    }
  }

  public createSplash() {
    // create and show the Splash Screen
    this.createSplashScreen();
    this.showSplashScreen();
  }

  public hideSplash() {
    // create and show the Splash Screen
    this.hideSplashScreen();
  }

  public start() {
    // set initial dimension parameters to full primary display dimensions
    const mainScreen = screen.getPrimaryDisplay();
    if (mainScreen && mainScreen.size) {
      this.Dimensions = mainScreen.size;
      console.log('initial display dimensions', mainScreen.size);
    }

    this.syncNTPtime();

    this.listenToUser();

    this.listenToClipboard();

    this.showLocation();

    this.createMainWindow();

    this.setupSystemTray();

    this.setupIpc();

    this.injectOverlay();

    const self = this;

    // sync NTP time (find delta to system time) every hour
    setInterval(() => {
      self.syncNTPtime();
    }, 3600000);
  }

  public activate() {
    this.openMainWindow();
  }

  public autoUpdate() {
    const window = this.getWindow('StatusBar');
    if (window) {
      if (toggleCounter) {
        flag = 'enabled';
        window.webContents.send('keysim', {
          counter: 6,
          flag: 'enabled',
        });
      } else {
        flag = 'disabled';
        window.webContents.send('keysim', {
          counter: 6,
          flag: 'disabled',
        });
      }
    }
  }

  public showFPS() {
    const window = this.getWindow('StatusBar');
    if (window) {
      if (toggleFPS) {
        window.webContents.send('showfps', true);
      } else {
        flag = 'disabled';
        window.webContents.send('showfps', false);
      }
    }
  }

  public hideToggle() {
    let window = this.getWindow('StatusBar');
    if (window) {
      if (toggleHide) {
        window.webContents.send('hide', true);
      } else {
        window.webContents.send('hide', false);
      }
    }

    window = this.getWindow('Location');
    if (window) {
      if (toggleHide) {
        window.webContents.send('hide', true);
      } else {
        window.webContents.send('hide', false);
      }
    }
  }

  public quit() {
    this.markQuit = true;
    this.closeMainWindow();
    this.closeAllWindows();
    if (this.tray) {
      this.tray.destroy();
    }
  }

  public minimize() {
    console.log('minimize');

    const {
      mainWindow,
    } = this;
    if (mainWindow) {
      mainWindow.hide();
    }
  }

  public stop() {
    if (this.Overlay) {
      this.Overlay.stop();
    }
  }

  public openLink(url: string) {
    shell.openExternal(url);
  }

  private createWindow(
    name: string,
    option: Electron.BrowserWindowConstructorOptions,
  ) {
    const window = new BrowserWindow(option);
    this.windows.set(name, window);
    window.on('closed', () => {
      this.windows.delete(name);
    });
    window.webContents.on('new-window', (e, url) => {
      e.preventDefault();
      shell.openExternal(url);
    });

    if (global.DEBUG) {
      window.webContents.on(
        'before-input-event',
        (event: Electron.Event, input: Electron.Input) => {
          if (input.key === 'F12' && input.type === 'keyDown') {
            window.webContents.openDevTools();
          }
        },
      );
    }

    return window;
  }

  public injectOverlay() {
    if (!this.OvHook) {
      this.OvHook = require('node-ovhook');
    }

    // check if Electron processs is elevated
    let elevated = false;
    const childProcess = require('child_process');
    try {
      childProcess.execFileSync('net', ['session'], {
        stdio: 'ignore',
      });

      elevated = true;
    } catch (e) {
      elevated = false;
    }

    // console.log(this.OvHook.getTopWindows())
    for (const window of this.OvHook.getTopWindows()) {
      if (window && window.executable && (window.executable.endsWith('\\LIVE\\Bin64\\StarCitizen.exe') || window.executable.endsWith('\\PTU\\Bin64\\StarCitizen.exe')) && window.title && window.title === 'Star Citizen') {
        console.log(' found Star Citizen process:', window.executable);
        console.log(` processId: ${window.processId}, threadId: ${window.threadId}, admin: ${window.admin}, title: ${window.title}\n--------------------`);
        console.log(` am I elevated? ${elevated}\n--------------------`);

        this.OvHook.injectProcess(window, {
          dllPath: path.join(global.CONFIG.distDir, 'overlay/n_overlay.dll'),
          dllPath64: path.join(global.CONFIG.distDir, 'overlay/n_overlay.x64.dll'),
          helper: path.join(global.CONFIG.distDir, 'overlay/n_ovhelper.exe'),
          helper64: path.join(global.CONFIG.distDir, 'overlay/n_ovhelper.x64.exe'),
        });
      }
    }
  }

  private setupIpc() {
    ipcMain.once('start', () => {
      if (!this.Overlay) {
        this.startOverlay();

        this.createOsrWindow();
        this.createLocationWindow();
        this.createOsrStatusbarWindow();
      }

      //      if (!this.OvHook) {
      //        this.OvHook = require('node-ovhook');
      //      }
    });

    ipcMain.on('app_version', (event) => {
      event.sender.send('app_version', {
        version: app.getVersion(),
      });
    });

    ipcMain.on('quit', () => {
      this.quit();
    });

    ipcMain.on('minimize', () => {
      this.minimize();
    });

    ipcMain.on('login', (event, {
      user,
      pass,
    }) => {
      const self = this;

      firebase.auth().signInWithEmailAndPassword(user, pass)
        .then((userCredential) => {
          // Write userJson to disk
          const currentUser = userCredential.user;
          store.set('user', JSON.stringify(currentUser.toJSON()));
        })
        .catch((error) => {
          console.log(error);

          const window = self.getWindow(AppWindows.main);
          if (window) {
            if (error && error.message) {
              window.webContents.send('error', error.message);
            } else if (error && error.code) {
              window.webContents.send('error', error.code);
            }
          }

          // Set userJson on disk to null
          store.set('user', null);

          firebase.auth().signOut().then(() => {
            console.log('signed out');
          }).catch((error2) => {
            console.log(error2);

            const window = self.getWindow(AppWindows.main);
            if (window) {
              if (error2 && error2.message) {
                window.webContents.send('error', error2.message);
              } else if (error2 && error2.code) {
                window.webContents.send('error', error2.code);
              }
            }
          });
        });
    });

    ipcMain.on('getUser', () => {
      const user = firebase.auth().currentUser;

      if (user) {
        console.log(user);
      } else {
        console.log('no user');
      }
    });

    ipcMain.on('logout', () => {
      const self = this;

      store.set('user', null);
      firebase.auth().signOut().then(() => {
        console.log('signed out');
      }).catch((error) => {
        console.log(error);

        const window = self.getWindow(AppWindows.main);
        if (window) {
          if (error && error.message) {
            window.webContents.send('error', error.message);
          } else if (error && error.code) {
            window.webContents.send('error', error.code);
          }
        }
      });
    });

    ipcMain.on('inject', (event, pid) => {
      console.log('--------------------');
      if (pid) {
        console.log(` trying injection, triggered by process ${pid}`);
      } else {
        console.log(' trying injection, triggered manually');
      }
      console.log('--------------------');

      this.injectOverlay();
    });

    ipcMain.on('osrClick', () => {
      this.createOsrTipWindow();
    });

    ipcMain.on('doit', () => {
      this.doit();
    });

    ipcMain.on('showOverlay', () => {
      toggleHide = false;

      this.hideToggle();
    });

    ipcMain.on('hideOverlay', () => {
      toggleHide = true;

      this.hideToggle();
    });

    ipcMain.on('fpsOn', () => {
      toggleFPS = true;
      this.showFPS();
    });

    ipcMain.on('fpsOff', () => {
      toggleFPS = false;
      this.showFPS();
    });

    ipcMain.on('updateOn', () => {
      toggleCounter = true;
      counter = 5;

      this.autoUpdate();
    });

    ipcMain.on('updateOff', () => {
      toggleCounter = false;
      counter = 5;

      this.autoUpdate();
    });

    ipcMain.on('startIntercept', () => {
      this.Overlay!.sendCommand({
        command: 'input.intercept',
        intercept: true,
      });
    });

    ipcMain.on('stopIntercept', () => {
      this.Overlay!.sendCommand({
        command: 'input.intercept',
        intercept: false,
      });
    });
  }

  private doit() {
    const name = 'OverlayTip';
    this.closeWindow(name);

    const display = screen.getDisplayNearestPoint(
      screen.getCursorScreenPoint(),
    );

    const window = this.createWindow(name, {
      width: 480,
      height: 270,
      frame: false,
      show: false,
      transparent: true,
      resizable: false,
      x: 0,
      y: 0,
      webPreferences: {
        offscreen: true,
      },
    });

    this.addOverlayWindow(name, window, 0, 0, undefined, true, true);

    // window.webContents.openDevTools({mode: "detach"})

    window.loadURL(
      fileUrl(path.join(global.CONFIG.distDir, 'doit/index.html')),
    );
  }

  private appClipboard() {
    const name = 'Clipboard';
    const wasOpen = this.closeWindow(name);

    const display = screen.getDisplayNearestPoint(
      screen.getCursorScreenPoint(),
    );

    if (!wasOpen) {
      const window = this.createWindow(name, {
        width: 100,
        height: 20,
        frame: false,
        show: false,
        transparent: true,
        resizable: false,
        x: 215,
        y: 15,
        backgroundColor: '#00000000',
        webPreferences: {
          nodeIntegration: false,
          offscreen: true,
        },
      });

      this.addOverlayWindow(name, window, 0, 0, undefined, true, true);

      // window.webContents.openDevTools({mode: "detach"})

      window.loadURL(
        fileUrl(path.join(global.CONFIG.distDir, 'index/daylight.html')),
      );
    }
  }
}

export {
  Application,
};
