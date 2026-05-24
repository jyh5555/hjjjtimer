import { spawnSync } from 'node:child_process'
import { networkInterfaces } from 'node:os'

function findLocalIp() {
  const interfaces = networkInterfaces()
  const preferred = []
  const fallback = []

  for (const group of Object.values(interfaces)) {
    for (const item of group ?? []) {
      if (item.family !== 'IPv4' || item.internal) {
        continue
      }

      if (
        item.address.startsWith('192.168.') ||
        item.address.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(item.address)
      ) {
        preferred.push(item.address)
      } else {
        fallback.push(item.address)
      }
    }
  }

  return preferred[0] ?? fallback[0] ?? null
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function printHelp() {
  console.log('Usage: npm run android:live -- [LOCAL_IP]')
  console.log('Example: npm run dev:host')
  console.log('         npm run android:live -- 192.168.1.23')
}

const arg = process.argv[2]
if (arg === '--help' || arg === '-h') {
  printHelp()
  process.exit(0)
}

const ip = arg || process.env.LOCAL_IP || findLocalIp()
const port = process.env.CAP_SERVER_PORT || '5173'

if (!ip) {
  console.error('No LAN IPv4 found. Run: npm run android:live -- YOUR_COMPUTER_IP')
  process.exit(1)
}

const serverUrl = `http://${ip}:${port}`
const env = {
  ...process.env,
  CAP_SERVER_URL: serverUrl,
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'

console.log(`Using live preview URL: ${serverUrl}`)
console.log('Make sure `npm run dev:host` is running first.')

run(npxCommand, ['cap', 'sync', 'android'], env)
run(npxCommand, ['cap', 'open', 'android'], env)
