/**
 * Browser half of the Codex account switcher: the row configuration page inside
 * Settings → Plugins. The page shows what the Host detected (Codex home, login,
 * account snapshots), lets the user pick an account, and saves the choice; the
 * Host half captures or switches the native Codex login on save.
 */
window.__ModuleLoader__.load({
  id: '@local/codex-account-switcher',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'codexAccountSwitcher'

    const en = {
      title: 'Codex accounts',
      description: 'Detect the local Codex login and switch between account snapshots.',
      summary: 'Switch the Codex login used by delegations.',
      detectedTitle: 'Detected on this machine',
      detecting: 'Reading…',
      codexHome: 'Codex home',
      login: 'Current Codex login',
      snapshots: 'Snapshot folder',
      snapshotsDefault: 'default (home/.codex-accounts)',
      accountsTitle: 'Account snapshots',
      accountCurrent: 'active now',
      accountsEmpty: 'No snapshot yet. Type a name below and save to snapshot the current Codex login.',
      accountsRoot: 'Snapshot folder',
      accountsRootHelp: 'Leave empty to use the default folder; saved snapshots live in sub-folders.',
      activeAccount: 'Account to use',
      activeAccountHelp:
        'Pick a snapshot above or type a name. Saving a new name snapshots the current Codex login under it; saving an existing name switches the Codex login to that snapshot. Leave empty to stop managing the login.',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      refresh: 'Detect again',
      refreshing: 'Reading…',
      failed: 'Save failed',
      revision: 'The detected values come from the Host; edits stay local until you save.',
      hint: 'Captured: %s',
      mismatch: 'The current Codex login is not the selected account "%s"; save once to switch back.',
      unsaved: 'The current Codex login is not saved as any account yet; type a name and save to snapshot it.',
      quotaTitle: 'Codex usage',
      quotaLoading: 'Reading usage…',
      quotaUnavailable: 'Usage is unavailable',
      quotaPlan: 'Plan',
      quota5h: '5-hour window',
      quotaWeek: 'Weekly window',
      quotaRemaining: 'remaining',
      quotaResets: 'resets',
      quotaCredits: 'Extra credits',
      quotaCreditsNone: 'none',
      quotaCreditsSome: 'balance %s',
      quotaUpdated: 'Updated',
      quotaHint:
        'Usage comes from Codex itself and is refreshed every 60 seconds, so time you spend in Codex also shows up here.',
      quotaNetworkHint:
        'Reading usage needs a network path to OpenAI. If it stays unavailable, fill in the proxy below (for example http://127.0.0.1:10090) or turn your proxy on.',
      proxyLabel: 'Proxy for usage queries',
      proxyHelp: 'Leave empty to auto-detect the system proxy.',
      proxyPlaceholder: 'http://127.0.0.1:10090',
    }

    const zh = {
      title: 'Codex 账号切换',
      description: '自动检测本机 Codex 登录，并在账号快照之间切换。',
      summary: '切换委派任务使用的 Codex 登录。',
      detectedTitle: '本机检测结果',
      detecting: '读取中…',
      codexHome: 'Codex 配置目录',
      login: '当前 Codex 登录',
      snapshots: '快照目录',
      snapshotsDefault: '默认（用户目录/.codex-accounts）',
      accountsTitle: '账号快照',
      accountCurrent: '当前生效',
      accountsEmpty: '还没有账号快照。在下面填一个名字并保存，就会把当前 Codex 登录存成这个账号。',
      accountsRoot: '快照目录',
      accountsRootHelp: '留空使用默认目录；每个账号是里面的一个子文件夹。',
      activeAccount: '要使用的账号',
      activeAccountHelp:
        '点上面的账号，或直接填名字。保存一个没有的名字＝把当前 Codex 登录存成该账号；保存已有的名字＝把 Codex 登录切换成那份快照。留空表示不再接管登录。',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      refresh: '重新检测',
      refreshing: '读取中…',
      failed: '保存失败',
      revision: '检测结果由 Host 写入；编辑只是草稿，保存后才生效。',
      hint: '已记录：%s',
      mismatch: '当前 Codex 登录不是所选账号「%s」；保存一次才会切回该账号。',
      unsaved: '当前 Codex 登录还没有存成任何账号；在下面填个名字保存就能登记。',
      quotaTitle: 'Codex 额度',
      quotaLoading: '正在读取额度…',
      quotaUnavailable: '额度未知',
      quotaPlan: '套餐',
      quota5h: '5 小时窗口',
      quotaWeek: '每周窗口',
      quotaRemaining: '剩余',
      quotaResets: '重置',
      quotaCredits: '额外额度',
      quotaCreditsNone: '无',
      quotaCreditsSome: '余额 %s',
      quotaUpdated: '更新于',
      quotaHint: '额度数据来自 Codex 本身，每 60 秒刷新一次——你在 Codex 里用掉的额度这边也会跟着减。',
      quotaNetworkHint:
        '读取额度需要能连上 OpenAI。如果一直显示未知，在下面填一下代理地址（例如 http://127.0.0.1:10090），或者先把代理打开。',
      proxyLabel: '额度查询代理',
      proxyHelp: '留空自动探测系统代理。',
      proxyPlaceholder: 'http://127.0.0.1:10090',
    }

    const styles = {
      container: {
        display: 'grid',
        gap: '16px',
        padding: '2px 0 10px',
        maxWidth: '680px',
      },
      section: {
        border: '.5px solid var(--dsw-alias-border-l2, #d9d9d9)',
        borderRadius: '10px',
        padding: '12px 14px',
      },
      sectionTitle: {
        color: 'var(--dsw-alias-label-primary, inherit)',
        fontSize: '13px',
        fontWeight: 600,
        margin: '0 0 10px',
      },
      row: {
        display: 'flex',
        gap: '10px',
        lineHeight: '1.6',
        padding: '2px 0',
      },
      rowLabel: {
        color: 'var(--dsw-alias-label-tertiary, #8a8a8a)',
        flex: '0 0 132px',
        fontSize: '12px',
      },
      rowValue: {
        color: 'var(--dsw-alias-label-primary, inherit)',
        fontSize: '12px',
        minWidth: 0,
        overflowWrap: 'anywhere',
      },
      mono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      },
      accounts: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
      },
      account: {
        alignItems: 'flex-start',
        background: 'var(--dsw-alias-bg-layer, #f6f6f6)',
        border: '.5px solid var(--dsw-alias-border-l2, #d9d9d9)',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'grid',
        gap: '2px',
        padding: '7px 10px',
        textAlign: 'left',
      },
      accountSelected: {
        borderColor: 'var(--dsw-alias-border-focus, #247bbf)',
        boxShadow: 'inset 0 0 0 1px var(--dsw-alias-border-focus, #247bbf)',
      },
      accountName: {
        color: 'var(--dsw-alias-label-primary, inherit)',
        fontSize: '13px',
        fontWeight: 600,
      },
      accountMeta: {
        color: 'var(--dsw-alias-label-tertiary, #8a8a8a)',
        fontSize: '11px',
      },
      accountBadge: {
        color: 'var(--dsw-alias-label-success, #1a7f4b)',
        fontSize: '11px',
        fontWeight: 600,
      },
      help: {
        color: 'var(--dsw-alias-label-tertiary, #8a8a8a)',
        fontSize: '12px',
        lineHeight: '1.5',
        margin: '4px 0 0',
      },
      label: {
        color: 'var(--dsw-alias-label-primary, inherit)',
        display: 'block',
        fontSize: '13px',
        fontWeight: 500,
        margin: '0 0 6px',
      },
      input: {
        background: 'var(--dsw-alias-bg-base, transparent)',
        border: '.5px solid var(--dsw-alias-border-l2, #d0d0d0)',
        borderRadius: '8px',
        boxSizing: 'border-box',
        color: 'var(--dsw-alias-label-primary, inherit)',
        font: 'inherit',
        padding: '7px 10px',
        width: '100%',
      },
      footer: {
        alignItems: 'center',
        display: 'flex',
        gap: '10px',
      },
      button: {
        background: 'var(--dsw-alias-bg-action, #247bbf)',
        border: 'none',
        borderRadius: '8px',
        color: 'var(--dsw-alias-label-on-action, #fff)',
        cursor: 'pointer',
        font: 'inherit',
        padding: '7px 16px',
      },
      buttonGhost: {
        background: 'transparent',
        border: '.5px solid var(--dsw-alias-border-l2, #d0d0d0)',
        borderRadius: '8px',
        color: 'var(--dsw-alias-label-primary, inherit)',
        cursor: 'pointer',
        font: 'inherit',
        padding: '7px 14px',
      },
      buttonDisabled: { cursor: 'progress', opacity: 0.6 },
      status: {
        color: 'var(--dsw-alias-label-secondary, #666)',
        fontSize: '12px',
      },
      error: {
        color: 'var(--dsw-alias-label-danger, #c0392b)',
        fontSize: '12px',
      },
      warn: {
        color: 'var(--dsw-alias-label-warning, #a86400)',
        fontSize: '12px',
        lineHeight: '1.5',
        margin: '8px 0 0',
      },
      quotaRow: {
        display: 'grid',
        gap: '4px',
        padding: '6px 0',
      },
      quotaHead: {
        display: 'flex',
        gap: '8px',
        justifyContent: 'space-between',
        fontSize: '12px',
      },
      quotaTrack: {
        background: 'var(--dsw-alias-bg-layer, #ededed)',
        borderRadius: '999px',
        height: '6px',
        overflow: 'hidden',
      },
      quotaFill: {
        background: 'var(--dsw-alias-bg-action, #247bbf)',
        borderRadius: '999px',
        height: '100%',
      },
      quotaFillWarn: {
        background: 'var(--dsw-alias-label-warning, #d08a00)',
        borderRadius: '999px',
        height: '100%',
      },
      quotaFillDanger: {
        background: 'var(--dsw-alias-label-danger, #c0392b)',
        borderRadius: '999px',
        height: '100%',
      },
    }

    function InfoRow(props) {
      return h(
        'div',
        { style: styles.row },
        h('span', { style: styles.rowLabel }, props.label),
        h(
          'span',
          { style: props.mono ? { ...styles.rowValue, ...styles.mono } : styles.rowValue },
          props.value,
        ),
      )
    }

    function parseAccounts(raw) {
      try {
        const parsed = JSON.parse(String(raw ?? '[]'))
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }

    function parseJson(raw) {
      try {
        return JSON.parse(String(raw ?? ''))
      } catch {
        return undefined
      }
    }

    function formatReset(seconds, withDate) {
      const value = Number(seconds)
      if (!Number.isFinite(value) || value <= 0) return ''
      const date = new Date(value * 1000)
      try {
        return new Intl.DateTimeFormat(undefined, withDate
          ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
          : { hour: '2-digit', minute: '2-digit' }).format(date)
      } catch {
        return date.toLocaleString()
      }
    }

    function Panel(props) {
      const t =
        typeof props.t === 'function'
          ? props.t
          : (key) => (zh[key] !== undefined ? zh[key] : en[key] !== undefined ? en[key] : key)
      const form = props.form
      if (props.view === 'summary') return h('span', null, t('summary'))

      const state = form === undefined ? undefined : form.state
      const remote = state === undefined ? {} : state.value || {}
      const [draft, setDraft] = React.useState(undefined)
      const [status, setStatus] = React.useState('idle')
      const [error, setError] = React.useState('')
      const [busy, setBusy] = React.useState(false)

      if (state === undefined) {
        return h('div', { style: styles.container }, h('p', { style: styles.help }, t('revision')))
      }

      const values = draft === undefined ? remote : { ...remote, ...draft }
      const accountsRoot = String(values.accountsRoot ?? '')
      const activeAccount = String(values.activeAccount ?? '')
      const detectedHome = String(values.detectedCodexHome ?? '')
      const detectedLogin = String(values.detectedLogin ?? '')
      const detectedResult = String(values.detectedResult ?? '')
      const accounts = parseAccounts(values.detectedAccounts)
      const currentAccount = accounts.find((account) => account.current === true)?.name ?? ''
      const accountMismatch =
        activeAccount !== '' && currentAccount !== '' && activeAccount !== currentAccount
      const unsavedLogin = currentAccount === ''
      const quota = parseJson(values.quotaSummary)
      const quotaStatus = String(values.quotaStatus ?? '')
      const quotaUpdatedAt = String(values.quotaUpdatedAt ?? '')
      const proxyUrl = String(values.proxyUrl ?? '')
      const quotaError = quotaStatus.startsWith('error:') ? quotaStatus.slice(6).trim() : ''
      const quotaReady = quotaStatus === 'ok' && quota !== undefined && quota !== null
      const dirty =
        accountsRoot !== String(remote.accountsRoot ?? '') ||
        activeAccount !== String(remote.activeAccount ?? '') ||
        proxyUrl !== String(remote.proxyUrl ?? '')

      const windowNode = (label, win, withDate) => {
        if (win === null || win === undefined) return null
        const used = Math.max(0, Math.min(100, Number(win.usedPercent ?? 0)))
        const remaining = Math.max(0, 100 - used)
        const fillStyle =
          remaining <= 0
            ? styles.quotaFillDanger
            : remaining <= 30
              ? styles.quotaFillWarn
              : styles.quotaFill
        const reset = formatReset(win.resetsAt, withDate)
        return h(
          'div',
          { style: styles.quotaRow, key: label },
          h(
            'div',
            { style: styles.quotaHead },
            h('span', null, label),
            h(
              'span',
              null,
              `${t('quotaRemaining')} ${remaining}%${
                reset === '' ? '' : ` · ${t('quotaResets')} ${reset}`
              }`,
            ),
          ),
          h(
            'div',
            { style: styles.quotaTrack },
            h('div', { style: { ...fillStyle, width: `${remaining}%` } }),
          ),
        )
      }
      const creditsText =
        quota !== null && quota !== undefined && quota.credits !== null && quota.credits !== undefined
          ? quota.credits.unlimited === true
            ? '∞'
            : quota.credits.hasCredits === true
              ? t('quotaCreditsSome').replace('%s', String(quota.credits.balance ?? ''))
              : t('quotaCreditsNone')
          : t('quotaCreditsNone')

      const edit = (patch) => {
        setDraft({ ...(draft ?? {}), ...patch })
        setStatus('idle')
        setError('')
      }

      const save = async () => {
        if (!dirty || status === 'saving') return
        setStatus('saving')
        setError('')
        try {
          await form.mutate(
            [
              { op: 'set', path: ['accountsRoot'], value: accountsRoot },
              { op: 'set', path: ['activeAccount'], value: activeAccount },
              { op: 'set', path: ['proxyUrl'], value: proxyUrl },
            ],
            state.revision,
          )
          setDraft(undefined)
          setStatus('saved')
        } catch (reason) {
          setStatus('failed')
          setError(String((reason && reason.message) || reason))
        }
      }

      const refresh = async () => {
        if (busy) return
        setBusy(true)
        setStatus('idle')
        setError('')
        try {
          await form.mutate(
            [{ op: 'set', path: ['detectRequest'], value: String(Date.now()) }],
            state.revision,
          )
        } catch (reason) {
          setStatus('failed')
          setError(String((reason && reason.message) || reason))
        } finally {
          setBusy(false)
        }
      }

      const idPrefix = React.useId()
      const accountNodes =
        accounts.length === 0
          ? h('p', { style: styles.help }, t('accountsEmpty'))
          : h(
              'div',
              { style: styles.accounts },
              accounts.map((account, index) => {
                const name = String(account.name ?? '')
                const selected = activeAccount === name
                return h(
                  'button',
                  {
                    key: `${name}-${index}`,
                    type: 'button',
                    title: account.login === '' ? name : String(account.login),
                    style: selected
                      ? { ...styles.account, ...styles.accountSelected }
                      : styles.account,
                    onClick: () => edit({ activeAccount: name }),
                  },
                  h('span', { style: styles.accountName }, name),
                  account.current === true
                    ? h('span', { style: styles.accountBadge }, t('accountCurrent'))
                    : account.login
                      ? h('span', { style: styles.accountMeta }, String(account.login))
                      : null,
                )
              }),
            )

      return h(
        'form',
        {
          style: styles.container,
          onSubmit: (event) => {
            event.preventDefault()
            void save()
          },
        },
        h(
          'section',
          { style: styles.section, 'aria-label': t('detectedTitle') },
          h('h3', { style: styles.sectionTitle }, t('detectedTitle')),
          h(InfoRow, {
            label: t('codexHome'),
            value: detectedHome === '' ? t('detecting') : detectedHome,
            mono: true,
          }),
          h(InfoRow, {
            label: t('login'),
            value: detectedLogin === '' ? t('detecting') : detectedLogin,
          }),
          h(InfoRow, {
            label: t('snapshots'),
            value: accountsRoot === '' ? t('snapshotsDefault') : accountsRoot,
            mono: accountsRoot !== '',
          }),
          accountMismatch
            ? h('p', { style: styles.warn }, t('mismatch').replace('%s', activeAccount))
            : unsavedLogin
              ? h('p', { style: styles.warn }, t('unsaved'))
              : null,
          h(
            'p',
            { style: styles.help },
            h(
              'button',
              {
                type: 'button',
                style: busy
                  ? { ...styles.buttonGhost, ...styles.buttonDisabled }
                  : styles.buttonGhost,
                onClick: () => void refresh(),
                disabled: busy,
              },
              busy ? t('refreshing') : t('refresh'),
            ),
          ),
        ),
        h(
          'section',
          { style: styles.section, 'aria-label': t('quotaTitle') },
          h('h3', { style: styles.sectionTitle }, t('quotaTitle')),
          quotaReady
            ? h(
                'div',
                null,
                h(InfoRow, {
                  label: t('quotaPlan'),
                  value: String(quota.planType === '' ? '—' : quota.planType),
                }),
                windowNode(t('quota5h'), quota.primary, false),
                windowNode(t('quotaWeek'), quota.secondary, true),
                h(InfoRow, { label: t('quotaCredits'), value: creditsText }),
                h(
                  'p',
                  { style: styles.help },
                  `${t('quotaUpdated')} ${
                    quotaUpdatedAt === '' ? '—' : new Date(quotaUpdatedAt).toLocaleString()
                  } · ${t('quotaHint')}`,
                ),
              )
            : h(
                'div',
                null,
                h(InfoRow, {
                  label: t('quotaUnavailable'),
                  value: quotaError === '' ? t('quotaLoading') : quotaError,
                }),
                h('p', { style: styles.warn }, t('quotaNetworkHint')),
              ),
        ),
        h(
          'section',
          { style: styles.section, 'aria-label': t('accountsTitle') },
          h('h3', { style: styles.sectionTitle }, t('accountsTitle')),
          accountNodes,
        ),
        h(
          'section',
          { style: styles.section },
          h('label', { htmlFor: `${idPrefix}-root`, style: styles.label }, t('accountsRoot')),
          h('input', {
            id: `${idPrefix}-root`,
            style: styles.input,
            value: accountsRoot,
            spellCheck: false,
            onChange: (event) => edit({ accountsRoot: event.target.value }),
          }),
          h('p', { style: styles.help }, t('accountsRootHelp')),
          h(
            'label',
            {
              htmlFor: `${idPrefix}-active`,
              style: { ...styles.label, marginTop: '12px' },
            },
            t('activeAccount'),
          ),
          h('input', {
            id: `${idPrefix}-active`,
            style: styles.input,
            value: activeAccount,
            spellCheck: false,
            placeholder: '001',
            onChange: (event) => edit({ activeAccount: event.target.value }),
          }),
          h('p', { style: styles.help }, t('activeAccountHelp')),
          h(
            'label',
            {
              htmlFor: `${idPrefix}-proxy`,
              style: { ...styles.label, marginTop: '12px' },
            },
            t('proxyLabel'),
          ),
          h('input', {
            id: `${idPrefix}-proxy`,
            style: styles.input,
            value: proxyUrl,
            spellCheck: false,
            placeholder: t('proxyPlaceholder'),
            onChange: (event) => edit({ proxyUrl: event.target.value }),
          }),
          h('p', { style: styles.help }, t('proxyHelp')),
        ),
        h(
          'div',
          { style: styles.footer },
          h(
            'button',
            {
              type: 'submit',
              disabled: !dirty || status === 'saving',
              style:
                !dirty || status === 'saving'
                  ? { ...styles.button, ...styles.buttonDisabled }
                  : styles.button,
            },
            status === 'saving' ? t('saving') : t('save'),
          ),
          status === 'saved' ? h('span', { style: styles.status }, t('saved')) : null,
          status === 'failed'
            ? h('span', { style: styles.error }, `${t('failed')}：${error}`)
            : null,
          dirty ? null : h('span', { style: styles.status }, t('revision')),
        ),
        detectedResult === ''
          ? null
          : h('p', { style: styles.help }, t('hint').replace('%s', detectedResult)),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { zh, en }),
          'codex-account-switcher: dictionaries',
        )
        ctx.slots.inject('plugins.row.config', () =>
          ctx.slots.register(
            {
              name: 'plugins.row.config',
              key: '@local/codex-account-switcher#codex-accounts',
              locale: NS,
            },
            Panel,
          ),
        )
      },
    }
  },
})
