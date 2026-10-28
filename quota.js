/**
 * Codex account quota ("rate limits") reader.
 *
 * The Codex app-server exposes `account/rateLimits/read`, which is what the
 * Codex UI itself uses. This module spawns the vendored app-server, performs the
 * initialize/initialized handshake, and returns one usage snapshot. It needs the
 * same network the Codex client needs: without a reachable proxy the backend
 * call fails and the caller reports that state instead of a number.
 */
import { spawn, execFile } from 'node:child_process'
import { mkdir, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const PROXY_KEYS = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
]

/** Candidate DSH profile directories. */
function profileCandidates() {
  const candidates = []
  if (process.env.DSH_PROFILE_DIR) candidates.push(process.env.DSH_PROFILE_DIR)
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  if (process.env.DSH_PROFILE) candidates.push(join(dshHome, 'profiles', process.env.DSH_PROFILE))
  candidates.push(join(dshHome, 'profiles', 'desktop'), join(dshHome, 'profiles', 'web'))
  return candidates
}

/**
 * Locate the Codex executable shipped with the Codex subagent bundle.
 * @returns the executable path, or `undefined` when the bundle is not installed.
 */
export async function findCodexExecutable() {
  const fromEnv = process.env.CODEX_CLI_PATH
  if (fromEnv && fromEnv.trim() !== '') return fromEnv.trim()
  const variants = ['x86_64-pc-windows-msvc', 'aarch64-pc-windows-msvc']
  for (const dir of profileCandidates()) {
    const vendorRoot = join(dir, 'node_modules', '@openai', 'codex-win32-x64', 'vendor')
    for (const variant of variants) {
      const executable = join(vendorRoot, variant, 'bin', 'codex.exe')
      try {
        await mkdir(dirname(executable), { recursive: true })
        await readdir(dirname(executable))
        return executable
      } catch {
        // try the next candidate
      }
    }
  }
  return undefined
}

/** Read the Windows system proxy, if one is configured. */
export function readSystemProxy() {
  return new Promise((resolve) => {
    execFile(
      'reg',
      [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
        '/v',
        'ProxyServer',
      ],
      { windowsHide: true, timeout: 5000 },
      (error, stdout) => {
        if (error || typeof stdout !== 'string') return resolve(undefined)
        const match = /ProxyServer\s+REG_SZ\s+(\S+)/i.exec(stdout)
        if (!match) return resolve(undefined)
        let value = match[1].trim()
        const httpsPart = /(?:^|;)https=([^;]+)/i.exec(value)
        if (httpsPart) value = httpsPart[1].trim()
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `http://${value}`
        resolve(value)
      },
    )
  })
}

/** Run one `account/rateLimits/read` against a freshly spawned app-server. */
function queryOnce(executable, proxy, timeoutMs) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    for (const key of PROXY_KEYS) delete env[key]
    if (proxy !== '') {
      env.HTTP_PROXY = proxy
      env.HTTPS_PROXY = proxy
      env.ALL_PROXY = proxy
      env.http_proxy = proxy
      env.https_proxy = proxy
      env.all_proxy = proxy
    }

    let child
    try {
      child = spawn(executable, ['app-server'], {
        stdio: ['pipe', 'pipe', 'ignore'],
        env,
        windowsHide: true,
      })
    } catch (error) {
      reject(error)
      return
    }

    let settled = false
    let buffer = ''
    let nextId = 1
    const pending = new Map()

    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        child.kill()
      } catch {
        // already gone
      }
      if (error) reject(error)
      else resolve(value)
    }

    const timer = setTimeout(() => finish(new Error('额度查询超时（可能没开代理）')), timeoutMs)

    const write = (message) => {
      try {
        child.stdin.write(`${JSON.stringify(message)}\n`)
      } catch {
        // stdin closed; the exit handler settles
      }
    }

    const request = (method, params) =>
      new Promise((res, rej) => {
        const id = nextId++
        pending.set(id, { res, rej })
        write({ jsonrpc: '2.0', id, method, params })
      })

    child.on('error', (error) => finish(error))
    child.on('exit', () => {
      if (!settled) finish(new Error('codex app-server 提前退出'))
    })

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      let index
      while ((index = buffer.indexOf('\n')) >= 0) {
        const raw = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (raw === '') continue
        let message
        try {
          message = JSON.parse(raw)
        } catch {
          continue
        }
        if (message.id === undefined) continue
        const entry = pending.get(message.id)
        if (entry === undefined) continue
        pending.delete(message.id)
        if (message.error !== undefined) {
          entry.rej(new Error(message.error.message || 'app-server error'))
        } else {
          entry.res(message.result)
        }
      }
    })

    void (async () => {
      try {
        await request('initialize', {
          clientInfo: { name: 'dsh-codex-account-switcher', version: '1.0.0' },
        })
        write({ jsonrpc: '2.0', method: 'initialized', params: {} })
        const result = await request('account/rateLimits/read', {})
        if (result === undefined || result.rateLimits === undefined) {
          throw new Error('app-server 没有返回 rateLimits')
        }
        finish(undefined, result)
      } catch (error) {
        finish(error)
      }
    })()
  })
}

/** Build the compact summary the configuration page renders. */
function summarize(data, proxy) {
  const limits = data.rateLimits ?? {}
  const window = (value) =>
    value === null || value === undefined
      ? null
      : {
          usedPercent: value.usedPercent ?? null,
          windowDurationMins: value.windowDurationMins ?? null,
          resetsAt: value.resetsAt ?? null,
        }
  return JSON.stringify({
    planType: limits.planType ?? '',
    primary: window(limits.primary),
    secondary: window(limits.secondary),
    credits:
      limits.credits === null || limits.credits === undefined
        ? null
        : {
            hasCredits: Boolean(limits.credits.hasCredits),
            unlimited: Boolean(limits.credits.unlimited),
            balance: limits.credits.balance ?? null,
          },
    rateLimitReachedType: limits.rateLimitReachedType ?? null,
    fetchedAt: new Date().toISOString(),
    viaProxy: proxy === '' ? 'direct' : proxy,
  })
}

/**
 * Read the current account usage.
 * @param configuredProxy - proxy URL from Config, may be empty.
 * @returns `{ ok: true, summary, proxy }` or `{ ok: false, message }`.
 */
export async function fetchQuota(configuredProxy) {
  const executable = await findCodexExecutable()
  if (executable === undefined) {
    return {
      ok: false,
      message: '找不到 Codex 可执行文件（需要先安装 Codex 子智能体插件）',
    }
  }

  const candidates = []
  if (configuredProxy !== '') candidates.push(configuredProxy)
  for (const key of PROXY_KEYS) {
    const value = process.env[key]
    if (value !== undefined && value.trim() !== '') candidates.push(value.trim())
  }
  const systemProxy = await readSystemProxy()
  if (systemProxy !== undefined) candidates.push(systemProxy)
  candidates.push('')

  const tried = new Set()
  let lastMessage = ''
  for (const proxy of candidates) {
    if (tried.has(proxy)) continue
    tried.add(proxy)
    try {
      const data = await queryOnce(executable, proxy, 25000)
      return { ok: true, summary: summarize(data, proxy), proxy }
    } catch (error) {
      lastMessage = String(error?.message ?? error)
    }
  }
  return { ok: false, message: lastMessage || '额度查询失败' }
}
