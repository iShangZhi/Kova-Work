const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

app.whenReady().then(async () => {
  const source = join(process.cwd(), 'resources/kova-icon.svg')
  const destination = join(process.cwd(), 'resources/kova-icon.png')
  const svg = readFileSync(source)
  const window = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true }
  })
  await window.loadURL(`data:image/svg+xml;base64,${svg.toString('base64')}`)
  const image = await window.webContents.capturePage()
  writeFileSync(destination, image.toPNG())
  window.destroy()
  app.quit()
}).catch((error) => {
  console.error(error)
  app.exit(1)
})
