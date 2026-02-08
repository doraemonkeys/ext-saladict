/** !
 * Upgrade PDF.js
 */

const shell = require('shelljs')
const path = require('path')
const fs = require('fs-extra')
const https = require('https')
const http = require('http')
const { execSync } = require('child_process')

const cacheDir = 'pdf'
const repoRoot = 'pdf'
const publicPDFRoot = path.join(__dirname, '../assets/pdf')
const pdfFiles = [
  'build/pdf.js',
  'build/pdf.worker.js',
  'web/debugger.js',
  'web/viewer.js',
  'web/viewer.html',
  'web/viewer.css'
]
const pdfDirs = ['web/cmaps', 'web/images', 'web/locale']
const files = [...pdfFiles, ...pdfDirs]

shell.cd(path.resolve(__dirname))

shell.rm('-rf', cacheDir)

const zipUrl = 'https://github.com/mozilla/pdf.js/releases/download/v2.16.105/pdfjs-2.16.105-dist.zip'
const zipFile = path.join(__dirname, 'pdfjs.zip')
const extractDir = path.join(__dirname, cacheDir)

async function downloadFile(url, dest, maxRedirects = 5) {
  if (maxRedirects <= 0) throw new Error('Too many redirects')
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        shell.echo('Redirecting to: ' + res.headers.location)
        downloadFile(res.headers.location, dest, maxRedirects - 1).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error('Download failed with status: ' + res.statusCode))
        return
      }
      const fileStream = fs.createWriteStream(dest)
      res.pipe(fileStream)
      fileStream.on('finish', () => { fileStream.close(); resolve() })
      fileStream.on('error', reject)
    }).on('error', reject)
  })
}

async function downloadAndExtract() {
  shell.echo('Downloading PDF.js...')
  await downloadFile(zipUrl, zipFile)
  shell.echo('Download complete. Extracting...')

  await fs.ensureDir(extractDir)

  // Use tar on all platforms (Windows 10+ has built-in tar with zip support)
  try {
    execSync(`tar -xf "${zipFile}" -C "${extractDir}"`, { stdio: 'inherit' })
  } catch (e) {
    // Fallback: try PowerShell Expand-Archive on Windows
    if (process.platform === 'win32') {
      execSync(`powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${extractDir}' -Force"`, { stdio: 'inherit' })
    } else {
      throw e
    }
  }

  await fs.remove(zipFile)
  shell.echo('Extraction complete.')
}

downloadAndExtract().then(() => {

  shell.cd(extractDir)
  return startUpgrade()
}).catch(err => {
  shell.echo('Error: ' + err.message)
  shell.exit(1)
})

async function startUpgrade() {
  shell.echo('\nChecking files.')
  await Promise.all(files.map(p => exists(path.join(__dirname, repoRoot, p))))

  shell.echo('\nModifying files.')
  await Promise.all([modifyViewrJS(), modifyViewerHTML()])

  await fs.ensureDir(publicPDFRoot)

  shell.echo('\nCloning files.')
  cleanInit()

  await cloneFiles()

  shell.echo('\nCleaning files.')
  shell.cd(path.resolve(__dirname))
  shell.rm('-rf', cacheDir)

  shell.echo('\ndone.')
}

async function modifyViewrJS() {
  const viewerPath = path.join(__dirname, repoRoot, 'web/viewer.js')
  let file = await fs.readFile(viewerPath, 'utf8')

  file = '/* saladict */ window.__SALADICT_PDF_PAGE__ = true;\n' + file

  // change default pdf
  const defaultPDFTester = /defaultUrl = {[\s\S]*?value: (['"]\S+?.pdf['"]),[\s\S]*?kind: OptionKind\.VIEWER/
  if (!defaultPDFTester.test(file)) {
    shell.echo('Could not locate default pdf in viewer.js')
    shell.exit(1)
  }
  file = file.replace(defaultPDFTester, (m, p1) =>
    m.replace(p1, "/* saladict */'/assets/default.pdf'")
  )

  // disable url check
  const validateTester = /validateFileURL\(file\);/
  if (!validateTester.test(file)) {
    shell.echo('Could not locate validateFileURL in viewer.js')
    shell.exit(1)
  }
  file = file.replace(validateTester, '/* saladict */')

  // force dark mode
  const viewCssTester = /"viewerCssTheme": 0,/
  if (!viewCssTester.test(file)) {
    shell.echo('Could not locate viewerCssTheme config in viewer.js')
    shell.exit(1)
  }
  file = file.replace(viewCssTester, '"viewerCssTheme": 2, /* saladict */')

  await fs.writeFile(viewerPath, file)
}

async function modifyViewerHTML() {
  const viewerPath = path.join(__dirname, repoRoot, 'web/viewer.html')
  let file = await fs.readFile(viewerPath, 'utf8')

  if (!file.includes(`</body>`)) {
    shell.echo('Could not locate </body> in viewer.html')
    shell.exit(1)
  }

  // Load Saladict dict panel
  file = file.replace(
    `</body>`,
    `
    <!-- Saladict -->
    <script src="/assets/browser-polyfill.min.js"></script>
    <script src="/assets/inject-dict-panel.js"></script>
    <script src="/assets/vimium-c-injector.js"></script>
  </body>
`
  )

  await fs.writeFile(viewerPath, file)
}

function cleanInit() {
  pdfDirs.forEach(name => {
    shell.rm('-rf', path.join(publicPDFRoot, name))
  })
}

async function exists(path) {
  try {
    await fs.access(path)
  } catch (e) {
    shell.echo(path + ' not exist')
    shell.exit(1)
  }
}

function exec(command, errorMsg) {
  const execResult = shell.exec(command)

  if (execResult.code !== 0) {
    if (errorMsg) {
      shell.echo(errorMsg)
    }
    shell.echo(execResult.stdout)
    shell.echo(execResult.stderr)
    shell.exit(1)
  }
}

async function cloneFiles() {
  for (const pdfFile of pdfFiles) {
    const targetPath = path.join(publicPDFRoot, pdfFile)
    await fs.ensureFile(targetPath)
    await fs.copy(path.join(__dirname, repoRoot, pdfFile), targetPath)
  }

  const restPdfDirs = pdfDirs.filter(name => name !== 'web/locale')

  for (const pdfDir of restPdfDirs) {
    const targetPath = path.join(publicPDFRoot, pdfDir)
    await fs.ensureDir(targetPath)
    await fs.copy(path.join(__dirname, repoRoot, pdfDir), targetPath)
  }

  // copy locale.properties
  await fs.ensureDir(path.join(publicPDFRoot, 'web/locale'))
  await fs.copy(
    path.join(__dirname, repoRoot, 'web/locale/locale.properties'),
    path.join(publicPDFRoot, 'web/locale/locale.properties')
  )

  const locales = (
    await fs.readdir(path.join(__dirname, repoRoot, 'web/locale'))
  ).filter(
    name =>
      name.startsWith('en') ||
      name.startsWith('zh') ||
      /^(ja|ko|uk)$/.test(name)
  )

  for (const locale of locales) {
    const targetPath = path.join(publicPDFRoot, 'web/locale', locale)
    await fs.ensureDir(targetPath)
    await fs.copy(
      path.join(__dirname, repoRoot, 'web/locale', locale),
      targetPath
    )
  }
}
