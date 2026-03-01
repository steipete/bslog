import type { LogEntry } from '../types'
import { getApiToken } from '../utils/config'

const TELEMETRY_BASE_URL = 'https://telemetry.betterstack.com/api/v1'
const QUERY_BASE_URL = process.env.BETTERSTACK_QUERY_ENDPOINT || 'https://eu-nbg-2-connect.betterstackdata.com'
const DEFAULT_TIMEOUT_MS = 30_000

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
  timeoutMs?: number
}

export class BetterStackClient {
  private token: string

  constructor() {
    this.token = getApiToken()
  }

  async request<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs, signal: providedSignal, headers: providedHeaders, ...rest } = options

    const headers = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...providedHeaders,
    }

    const { signal, dispose } = createRequestSignal(providedSignal, timeoutMs)

    try {
      const response = await fetch(url, {
        ...rest,
        headers,
        signal,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`API request failed: ${response.status} - ${error}`)
      }

      return response.json() as Promise<T>
    } finally {
      dispose()
    }
  }

  telemetry<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${TELEMETRY_BASE_URL}${path}`
    return this.request<T>(url, options)
  }

  async query<T extends Record<string, unknown> = LogEntry>(
    sql: string,
    username?: string,
    password?: string,
  ): Promise<T[]> {
    // Query API can use either Bearer token or Basic auth
    const headers: Record<string, string> = {
      'Content-Type': 'text/plain',
    }

    if (username && password) {
      // Use Basic auth if username/password provided
      const auth = Buffer.from(`${username}:${password}`).toString('base64')
      headers.Authorization = `Basic ${auth}`
    } else {
      // Use Bearer token authentication (same as Telemetry API)
      headers.Authorization = `Bearer ${this.token}`
    }

    const { signal, dispose } = createRequestSignal(undefined, DEFAULT_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(QUERY_BASE_URL, {
        method: 'POST',
        headers,
        body: sql,
        signal,
      })
    } finally {
      dispose()
    }

    if (!response.ok) {
      const error = await response.text()

      // Provide helpful error messages for common issues
      if (response.status === 400 && error.includes('Malformed token')) {
        throw new Error(
          `Query API authentication failed: Malformed token\n\n` +
            `This usually means your Query API credentials are not set.\n\n` +
            `Current environment:\n` +
            `  BETTERSTACK_API_TOKEN: ${process.env.BETTERSTACK_API_TOKEN ? '✓ Set' : '✗ Not set'}\n` +
            `  BETTERSTACK_QUERY_USERNAME: ${process.env.BETTERSTACK_QUERY_USERNAME ? '✓ Set' : '✗ Not set'}\n` +
            `  BETTERSTACK_QUERY_PASSWORD: ${process.env.BETTERSTACK_QUERY_PASSWORD ? '✓ Set' : '✗ Not set'}\n\n` +
            `To fix this:\n` +
            `1. Add these to your ~/.zshrc or ~/.bashrc:\n` +
            `   export BETTERSTACK_QUERY_USERNAME="your_username"\n` +
            `   export BETTERSTACK_QUERY_PASSWORD="your_password"\n\n` +
            `2. Reload your shell:\n` +
            `   source ~/.zshrc\n\n` +
            `3. Or set them for this session:\n` +
            `   export BETTERSTACK_QUERY_USERNAME="your_username"\n` +
            `   export BETTERSTACK_QUERY_PASSWORD="your_password"\n\n` +
            `To get Query API credentials:\n` +
            `1. Go to Better Stack > Logs > Dashboards\n` +
            `2. Click "Connect remotely"\n` +
            `3. Create credentials and save them`,
        )
      }

      if (
        response.status === 403 ||
        response.status === 401 ||
        error.includes('Authentication failed')
      ) {
        if (!username || !password) {
          throw new Error(
            `Query API authentication failed.\n\n` +
              `The Query API requires separate credentials from your API token.\n` +
              `To create credentials:\n` +
              `1. Go to Better Stack > Logs > Dashboards\n` +
              `2. Click "Connect remotely"\n` +
              `3. Create credentials and save them\n\n` +
              `Then set them as environment variables:\n` +
              `export BETTERSTACK_QUERY_USERNAME="your_username"\n` +
              `export BETTERSTACK_QUERY_PASSWORD="your_password"\n\n` +
              `Or pass them directly:\n` +
              `bslog tail --username "user" --password "pass"`,
          )
        }
        throw new Error(`Authentication failed. Please check your Query API credentials.`)
      }

      throw new Error(`Query failed: ${response.status} - ${error}`)
    }

    const text = await response.text()

    // Parse JSONEachRow format (each line is a JSON object)
    const lines = text
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
    const rows: T[] = []

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed && typeof parsed === 'object') {
          rows.push(parsed as T)
        } else {
          console.error('Unexpected row payload:', line)
        }
      } catch (_error) {
        console.error('Failed to parse line:', line)
      }
    }

    return rows
  }
}

function createRequestSignal(existing: AbortSignal | undefined, timeoutMs: number | undefined) {
  if (existing) {
    return {
      signal: existing,
      dispose: () => {
        /* no-op */
      },
    }
  }

  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (typeof AbortSignal !== 'undefined') {
    const abortSignalWithTimeout = (
      AbortSignal as typeof AbortSignal & {
        timeout?: (ms: number) => AbortSignal
      }
    ).timeout

    if (typeof abortSignalWithTimeout === 'function') {
      return {
        signal: abortSignalWithTimeout(timeout),
        dispose: () => {
          /* no-op */
        },
      }
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeout)

  if (typeof timer === 'object' && typeof (timer as NodeJS.Timeout).unref === 'function') {
    ;(timer as NodeJS.Timeout).unref()
  }

  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timer),
  }
}
