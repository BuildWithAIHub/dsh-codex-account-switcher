/**
 * Host half of the Codex account switcher.
 *
 * The Codex subagent provider keeps its native Codex configuration and
 * authentication: it reads `$CODEX_HOME/auth.json` (default `~/.codex`) when a
 * delegation starts. This plugin:
 *
 * - detects the Codex home and the login on the machine,
 * - keeps named snapshots of `auth.json` and swaps the active one in,
 * - publishes the detection result into its own Config so the Plugins page
 *   configuration form can show it without hand-editing paths.
 */
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchQuota } from './quota.js'

/**
 * Load the Schemastery copy installed in this DSH profile.
 *
 * A directory-installed bundle may be linked from the workspace, where Node
 * cannot see the profile's `node_modules`; load the profile copy explicitly.
 */
function loadSchemastery() {
  const candidates = []
  if (process.env.DSH_PROFILE_DIR) candidates.push(process.env.DSH_PROFILE_DIR)
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  if (process.env.DSH_PROFILE) candidates.push(join(dshHome, 'profiles', process.env.DSH_PROFILE))
  candidates.push(join(dshHome, 'profiles', 'desktop'), join(dshHome, 'profiles', 'web'))
  if (process.resourcesPath) candidates.push(join(process.resourcesPath, 'app.asar', 'dsh'))
  for (const dir of candidates) {
    try {
      const requireFrom = createRequire(join(dir, 'package.json'))
      const loaded = requireFrom('@deepseek-ai/schemastery')
      return loaded.default ?? loaded
    } catch {
      // try the next candidate
    }
  }
  throw new Error('无法从 DSH profile 的 node_modules 加载 @deepseek-ai/schemastery')
}

const z = loadSchemastery()

/** Read a file, or `undefined` when it does not exist. */
async function readOrUndefined(path) {
  try {
    return await readFile(path)
  } catch {
    return undefined
  }
}

/** Stable digest of the auth file bytes. */
function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Candidate native Codex homes, in priority order. */
function nativeCodexCandidates() {
  const homes = []
  const fromEnv = process.env.CODEX_HOME
  if (fromEnv && fromEnv.trim() !== '') homes.push(fromEnv.trim())
  homes.push(join(homedir(), '.codex'))
  return homes
}

/** Locate the native Codex home that actually carries a login. */
async function detectNative() {
  for (const home of nativeCodexCandidates()) {
    const auth = await readOrUndefined(join(home, 'auth.json'))
    if (auth !== undefined) return { home, auth }
  }
  const home = nativeCodexCandidates()[0]
  return { home, auth: await readOrUndefined(join(home, 'auth.json')) }
}

/** Decode one JWT payload without verifying it (local display only). */
function decodeJwtPayload(token) {
  try {
    const part = String(token).split('.')[1]
    if (!part) return undefined
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return undefined
  }
}

/** Mask an email for display. */
function maskEmail(email) {
  const at = email.indexOf('@')
  if (at <= 1) return email
  return `${email[0]}***${email.slice(at)}`
}

/** Describe one `auth.json` value without exposing tokens. */
function describeAuth(bytes) {
  if (bytes === undefined) return { summary: '未登录', name: '', email: '', plan: '' }
  let data
  try {
    data = JSON.parse(bytes.toString('utf8'))
  } catch {
    return { summary: '已登录（无法解析）', name: '', email: '', plan: '' }
  }
  if (typeof data?.OPENAI_API_KEY === 'string' && data.OPENAI_API_KEY !== '') {
    return { summary: '已登录 · API Key', name: '', email: '', plan: '' }
  }
  const idToken = data?.tokens?.id_token
  const claims = idToken === undefined ? undefined : decodeJwtPayload(idToken)
  const email = typeof claims?.email === 'string' ? claims.email : ''
  const name = typeof claims?.name === 'string' ? claims.name : ''
  const plan =
    claims?.['https://api.openai.com/auth']?.chatgpt_plan_type ??
    claims?.chatgpt_plan_type ??
    ''
  const who =
    name !== '' && email !== ''
      ? `${name}（${maskEmail(email)}）`
      : name !== ''
        ? name
        : email !== ''
          ? maskEmail(email)
          : ''
  if (who !== '') {
    return {
      summary: `已登录 · ${who}${plan === '' ? '' : ` · ${plan}`}`,
      name,
      email,
      plan: String(plan),
    }
  }
  if (idToken !== undefined) {
    return { summary: '已登录（未暴露身份）', name: '', email: '', plan: '' }
  }
  return { summary: '已登录（未知身份）', name: '', email: '', plan: '' }
}

/** List snapshot accounts under the accounts root. */
async function listAccounts(root, nativeAuth) {
  let dirents
  try {
    dirents = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const nativeDigest = nativeAuth === undefined ? '' : digest(nativeAuth)
  const accounts = []
  for (const dirent of dirents) {
    if (!dirent.isDirectory() || dirent.name.startsWith('_')) continue
    const dir = join(root, dirent.name)
    const auth = await readOrUndefined(join(dir, 'auth.json'))
    if (auth === undefined) continue
    let modifiedAt = ''
    try {
      modifiedAt = (await stat(join(dir, 'auth.json'))).mtime.toISOString()
    } catch {
      modifiedAt = ''
    }
    const identity = describeAuth(auth)
    accounts.push({
      name: dirent.name,
      login: identity.summary,
      email: identity.email === '' ? '' : maskEmail(identity.email),
      modifiedAt,
      current: nativeDigest !== '' && digest(auth) === nativeDigest,
    })
  }
  accounts.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return accounts
}

/** Reject account names that could escape the snapshot root. */
function validAccountName(name) {
  return /^[\p{L}\p{N}._-]{1,64}$/u.test(name) && name !== '.' && name !== '..'
}

/** Write the marker that records the last applied account. */
async function writeMarker(root, active) {
  try {
    await writeFile(
      join(root, '.active.json'),
      JSON.stringify({ active, updatedAt: new Date().toISOString() }, null, 2),
    )
  } catch {
    // marker is informational only
  }
}

/**
 * Capture or apply one account snapshot.
 * @returns a short result message for the configuration page.
 */
async function applyAccount(logger, root, active, native) {
  if (!validAccountName(active)) {
    return `账号名不合法：${active}`
  }
  const accountDir = join(root, active)
  const accountAuth = join(accountDir, 'auth.json')
  const nativeAuthPath = join(native.home, 'auth.json')
  const accountBytes = await readOrUndefined(accountAuth)

  await mkdir(accountDir, { recursive: true })

  if (accountBytes === undefined) {
    if (native.auth === undefined) {
      return `没有找到 Codex 登录（${nativeAuthPath}），无法把当前登录保存为「${active}」`
    }
    await writeFile(accountAuth, native.auth)
    const configBytes = await readOrUndefined(join(native.home, 'config.toml'))
    if (configBytes !== undefined) {
      try {
        await writeFile(join(accountDir, 'config.toml'), configBytes)
      } catch {
        // optional copy
      }
    }
    await writeMarker(root, active)
    logger.info(`[codex-accounts] 已把当前 Codex 登录保存为账号「${active}」`)
    return `已把当前登录保存为账号「${active}」`
  }

  if (native.auth !== undefined && digest(native.auth) === digest(accountBytes)) {
    await writeMarker(root, active)
    return `账号「${active}」就是当前登录，无需切换`
  }

  if (native.auth !== undefined) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = join(root, '_auto', stamp)
    try {
      await mkdir(backupDir, { recursive: true })
      await writeFile(join(backupDir, 'auth.json'), native.auth)
      await writeFile(
        join(backupDir, 'README.txt'),
        `切换账号前自动备份的原 Codex 登录（${stamp}）\n`,
      )
    } catch (error) {
      logger.warn(`[codex-accounts] 备份原登录失败：${error}`)
    }
  }

  await mkdir(native.home, { recursive: true })
  await copyFile(accountAuth, nativeAuthPath)
  await writeMarker(root, active)
  logger.info(`[codex-accounts] 已切换到账号「${active}」`)
  return `已切换到账号「${active}」`
}

/**
 * Run an operation outside the HMR transaction context.
 *
 * Activation and Config-change listeners run while HMR holds an
 * AsyncLocalStorage transaction, and that store propagates into timers, so a
 * Config write there fails with "HMR transactions cannot be nested". HMR's own
 * watcher escapes the same way through `executing.exit`.
 */
async function outsideHmrTransaction(ctx, operation) {
  const hmr = ctx.get('hmr')
  const executing = hmr === undefined ? undefined : hmr.executing
  if (
    executing !== undefined &&
    typeof executing.exit === 'function' &&
    executing.getStore() !== undefined
  ) {
    return executing.exit(operation)
  }
  return operation()
}

/**
 * Publish detection values into this entry's own Config so the configuration
 * page can render them. Writes a small debug record beside this package so a
 * failure here is diagnosable without host logs.
 * @returns `{ ok: true }` or `{ ok: false, error }`.
 */
async function publishDetection(ctx, patch) {
  const info = {
    at: new Date().toISOString(),
    fiberEntryId: ctx.fiber?.entry?.options?.id ?? null,
  }
  let result = { ok: false, error: 'no writer available' }

  const settings = ctx.get('settings')
  info.hasSettings = settings !== undefined
  if (settings !== undefined) {
    try {
      const descriptors = settings.describe({ redactSecrets: true })
      info.settingsNs = descriptors.map((row) => row.ns)
      const descriptor = descriptors.find((row) => row.ns === 'codex-accounts')
      if (descriptor !== undefined) {
        try {
          await outsideHmrTransaction(ctx, () =>
            settings.update('codex-accounts', patch, descriptor.revision),
          )
          info.settingsResult = 'ok:codex-accounts'
          result = { ok: true }
        } catch (error) {
          info.settingsError = String(error)
        }
      } else {
        info.settingsError = 'namespace codex-accounts not described'
      }
    } catch (error) {
      info.describeError = String(error)
    }
  }

  if (!result.ok) {
    const editor = ctx.get('configEditor')
    info.hasConfigEditor = editor !== undefined
    if (editor !== undefined) {
      try {
        info.entryIds = editor.entries().map((row) => String(row?.options?.id ?? ''))
      } catch (error) {
        info.entriesError = String(error)
      }
      let entry = ctx.fiber?.entry
      if (entry === undefined && Array.isArray(info.entryIds)) {
        entry = editor
          .entries()
          .find((row) => String(row?.options?.id ?? '').endsWith('codex-accounts'))
      }
      info.entryId = entry?.options?.id ?? null
      if (entry !== undefined) {
        try {
          await outsideHmrTransaction(ctx, () =>
            editor.edit(entry, (current) => ({ ...(current ?? {}), ...patch })),
          )
          info.configEditorResult = 'ok'
          result = { ok: true }
        } catch (error) {
          info.configEditorError = String(error)
        }
      }
    }
  }

  try {
    if (!result.ok) {
      await writeFile(fileURLToPath(new URL('debug.json', import.meta.url)), JSON.stringify(info, null, 2))
    }
  } catch {
    // debug record is best effort
  }
  return info.settingsResult === 'ok:codex-accounts' || info.configEditorResult === 'ok'
    ? { ok: true }
    : { ok: false, error: info.settingsError ?? info.configEditorError ?? result.error }
}

/** Publish with retries, because activation can still sit inside an HMR transaction. */
async function publishWithRetry(ctx, patch) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await publishDetection(ctx, patch)
    if (result.ok) return true
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
  }
  ctx.logger.warn('[codex-accounts] 写入检测结果失败（可能是 HMR 事务嵌套），下次刷新时会再试')
  return false
}

/** Read one volatile Config value as a trimmed string. */
function readString(config, name) {
  try {
    return String(config[name]?.get() ?? '')
  } catch {
    return ''
  }
}

/**
 * Detect the machine and publish the detection. Only an explicit change of the
 * configured account applies a switch; background detection never overwrites a
 * login the user made in Codex itself.
 * @param ctx - plugin context.
 * @param config - volatile Config references.
 * @param state - per-activation memory of the account last applied.
 */
async function reconcile(ctx, config, state) {
  const rootRaw = readString(config, 'accountsRoot').trim()
  const root = rootRaw === '' ? join(homedir(), '.codex-accounts') : rootRaw
  const active = readString(config, 'activeAccount').trim()

  await mkdir(root, { recursive: true }).catch(() => {})

  let actionMessage = ''
  if (active === '') {
    state.lastActive = ''
  } else if (active !== state.lastActive) {
    try {
      const native = await detectNative()
      actionMessage = await applyAccount(ctx.logger, root, active, native)
    } catch (error) {
      actionMessage = `应用账号失败：${error}`
      ctx.logger.warn(`[codex-accounts] ${actionMessage}`)
    }
    state.lastActive = active
  }

  const nativeAfter = await detectNative()
  const identity = describeAuth(nativeAfter.auth)
  const accounts = await listAccounts(root, nativeAfter.auth)
  const previousResult = readString(config, 'detectedResult')

  const detection = {
    detectedCodexHome: nativeAfter.home,
    detectedLogin: identity.summary,
    detectedAccounts: JSON.stringify(accounts),
    detectedResult: actionMessage === '' ? previousResult : actionMessage,
  }

  const current = {
    detectedCodexHome: readString(config, 'detectedCodexHome'),
    detectedLogin: readString(config, 'detectedLogin'),
    detectedAccounts: readString(config, 'detectedAccounts'),
    detectedResult: readString(config, 'detectedResult'),
  }

  const changed = Object.keys(detection).some((key) => detection[key] !== current[key])
  if (changed) await publishWithRetry(ctx, detection)
}

export const Config = z.object({
  accountsRoot: z
    .string()
    .default('')
    .description('账号快照目录；留空自动使用 用户目录/.codex-accounts')
    .volatile(),
  activeAccount: z
    .string()
    .default('')
    .description('当前使用的账号名；留空表示不接管，继续使用 Codex 自己的登录')
    .volatile(),
  detectRequest: z
    .string()
    .default('')
    .description('刷新检测的标记（由配置页写入时间戳）')
    .volatile(),
  detectedCodexHome: z
    .string()
    .default('')
    .description('检测到的本机 Codex 配置目录（只读，由插件写入）')
    .volatile(),
  detectedLogin: z
    .string()
    .default('')
    .description('检测到的本机 Codex 登录状态（只读，由插件写入）')
    .volatile(),
  detectedAccounts: z
    .string()
    .default('[]')
    .description('检测到的账号快照列表 JSON（只读，由插件写入）')
    .volatile(),
  detectedResult: z
    .string()
    .default('')
    .description('上一次切换的结果说明（只读，由插件写入）')
    .volatile(),
  proxyUrl: z
    .string()
    .default('')
    .description('查询 Codex 额度用的代理地址，例如 http://127.0.0.1:10090；留空自动探测系统代理')
    .volatile(),
  quotaSummary: z
    .string()
    .default('')
    .description('Codex 额度快照 JSON（只读，由插件写入）')
    .volatile(),
  quotaStatus: z
    .string()
    .default('')
    .description('额度查询状态（只读，由插件写入）')
    .volatile(),
  quotaUpdatedAt: z
    .string()
    .default('')
    .description('额度更新时间（只读，由插件写入）')
    .volatile(),
})

/**
 * Register the switcher: detect on activation, on live Config changes, and on
 * the page's refresh request.
 * @param ctx - the plugin context.
 * @param config - validated volatile Config references.
 */
export function apply(ctx, config) {
  let chain = Promise.resolve()
  let timer
  let quotaBusy = false
  let lastQuotaRequest = readString(config, 'detectRequest')
  let lastProxyUrl = readString(config, 'proxyUrl').trim()
  const state = { lastActive: readString(config, 'activeAccount').trim() }

  const run = () => {
    chain = chain
      .then(() => reconcile(ctx, config, state))
      .catch((error) => {
        ctx.logger.warn(`[codex-accounts] 处理失败：${error}`)
      })
    return chain
  }

  const schedule = (delayMs) => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void run()
    }, delayMs)
  }

  /** Read the account usage through the Codex app-server (needs network). */
  const refreshQuota = async () => {
    if (quotaBusy) return
    quotaBusy = true
    try {
      const result = await fetchQuota(readString(config, 'proxyUrl').trim())
      let patch
      if (result.ok) {
        const strip = (raw) => {
          try {
            const data = JSON.parse(raw)
            delete data.fetchedAt
            return JSON.stringify(data)
          } catch {
            return String(raw)
          }
        }
        const unchanged =
          readString(config, 'quotaStatus') === 'ok' &&
          strip(result.summary) === strip(readString(config, 'quotaSummary'))
        if (unchanged) return
        patch = {
          quotaSummary: result.summary,
          quotaStatus: 'ok',
          quotaUpdatedAt: new Date().toISOString(),
        }
      } else {
        patch = { quotaStatus: `error: ${result.message}` }
      }
      const changed = Object.entries(patch).some(
        ([key, value]) => readString(config, key) !== String(value),
      )
      if (changed) await publishWithRetry(ctx, patch)
    } catch (error) {
      ctx.logger.warn(`[codex-accounts] 额度查询失败：${error}`)
    } finally {
      quotaBusy = false
    }
  }

  ctx.effect(() => {
    // Activation happens inside an HMR transaction; writing Config before it
    // settles fails with "HMR transactions cannot be nested".
    schedule(1200)
    // Background detection: keep the page in sync when Codex itself logs in or
    // out, without ever applying a switch by itself.
    const detectionPoll = setInterval(() => schedule(0), 10000)
    // Usage is a network read; polling it keeps the page in sync when the user
    // works in Codex itself.
    const quotaStart = setTimeout(() => void refreshQuota(), 4000)
    const quotaPoll = setInterval(() => void refreshQuota(), 60000)
    return () => {
      if (timer !== undefined) clearTimeout(timer)
      clearInterval(detectionPoll)
      clearTimeout(quotaStart)
      clearInterval(quotaPoll)
    }
  }, 'codex-account-switcher: initial detection')

  ctx.effect(
    () =>
      ctx.on('loader/volatile-update', () => {
        schedule(600)
        const request = readString(config, 'detectRequest')
        if (request !== lastQuotaRequest) {
          lastQuotaRequest = request
          void refreshQuota()
        }
        const proxy = readString(config, 'proxyUrl').trim()
        if (proxy !== lastProxyUrl) {
          lastProxyUrl = proxy
          void refreshQuota()
        }
      }),
    'codex-account-switcher: live config',
  )
}
