import {
  ipcRenderer
} from "electron"
import {
  IpcRendererEvent
} from "electron/main"


function getArrayWithLimitedLength(length) {
  let array = new Array();

  array.push = function () {
    if (this.length >= length) {
      this.shift();
    }
    return Array.prototype.push.apply(this, arguments);
  }

  return array;

}

let logArray = getArrayWithLimitedLength(100);

const logfile = document.getElementById('logfile')
ipcRenderer.on('append_log', (event, entry) => {

  logArray.push(Date.now() + ' - ' + entry)
  logfile.innerText = logArray.join("\r\n")
  logfile.scrollTop = logfile.scrollHeight;

});



// //// watch processes
const WQL = window.require('wql-process-monitor');

const stopMonitor = document.getElementById("stopMonitor")
stopMonitor.addEventListener("click", () => {
  WQL.closeEventSink();
})

WQL.createEventSink(); //init the event sink
const processMonitor = WQL.subscribe({
  filterWindowsNoise: false,
  filter:  ["verseguide.exe","electron.exe"],
}); //subscribe to all events, including chatter (only way to get trggered by admin processes)

processMonitor.on("creation", ([process, pid, filepath]) => {

  logArray.push(Date.now() + ' - ' + 'Process monitor (creation): ' + process + ' (PID ' + pid + ')')
  logfile.innerText = logArray.join("\r\n")
  logfile.scrollTop = logfile.scrollHeight;

  if (process === 'StarCitizen.exe') {
    console.log(`Star Citizen launched: ${process}::${pid} ["${filepath}"]`);

    setTimeout(() => {
      console.log('Starting VerseGuide Overlay');
      ipcRenderer.send("inject", pid)
    }, 10000); //delay injection by 10 seconds

  }
});

processMonitor.on("deletion", ([process, pid]) => {

  logArray.push(Date.now() + ' - ' + 'Process monitor (deletion): ' + process + ' (PID ' + pid + ')')
  logfile.innerText = logArray.join("\r\n")
  logfile.scrollTop = logfile.scrollHeight;

  if (process === 'StarCitizen.exe') {
    console.log('Star Citizen terminated');
  }
});
// ////

const startButton = document.getElementById("start") as HTMLButtonElement
startButton.addEventListener("click", () => {
  ipcRenderer.send("start")
})

const injectButton = document.getElementById("inject") as HTMLButtonElement

injectButton.addEventListener("click", () => {
  ipcRenderer.send("inject", null)
})

//send 'start' once main window is loaded (to create overlays, only happens once)
document.addEventListener('DOMContentLoaded', (event) => {
  ipcRenderer.send('start')
})

// const canvas = document.getElementById("canvas") as HTMLCanvasElement
// const context = canvas.getContext("2d")!

const imageElem = document.getElementById("image") as HTMLImageElement

ipcRenderer.on("osrImage", (event: IpcRendererEvent, arg: {
  image: string
}) => {
  const {
    image
  } = arg
  imageElem.src = image
})

window.onfocus = function() {
  console.log("focus")
}
window.onblur = function() {
  console.log("blur")
}
