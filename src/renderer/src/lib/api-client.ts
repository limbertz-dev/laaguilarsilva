import type { AppApi } from '../../../shared/contracts/api'
import { platform } from './platform'
import { createMockApi } from './mock-data'

let client: AppApi | null = null
let clientPromise: Promise<AppApi> | null = null

if (platform === 'electron') {
  if (!window.api) throw new Error('window.api is not available.')
  client = window.api
} else if (platform === 'capacitor') {
  clientPromise = import('./sqlite').then((m) => m.createSqliteApi()).then((c) => {
    client = c
    return c
  })
} else {
  client = createMockApi()
}

function lazyAccess(prop: string) {
  const call = (...args: unknown[]): unknown => {
    if (client) {
      const val = (client as unknown as Record<string, unknown>)[prop]
      if (typeof val === 'function') return val.apply(client, args)
      throw new Error(`${prop} is not a function`)
    }
    if (!clientPromise) throw new Error('Database not initialized')
    return clientPromise.then((c) => {
      const val = (c as unknown as Record<string, unknown>)[prop]
      if (typeof val === 'function') return val.apply(c, args)
      throw new Error(`${prop} is not a function`)
    })
  }

  return new Proxy(call, {
    get(_target, methodProp) {
      return (...args: unknown[]): unknown => {
        if (client) {
          const ns = (client as unknown as Record<string, unknown>)[prop] as unknown as Record<string, unknown>
          const method = ns[methodProp as string] as (...a: unknown[]) => unknown
          return method.apply(ns, args)
        }
        if (!clientPromise) throw new Error('Database not initialized')
        return clientPromise.then((c) => {
          const ns = (c as unknown as Record<string, unknown>)[prop] as unknown as Record<string, unknown>
          const method = ns[methodProp as string] as (...a: unknown[]) => unknown
          return method.apply(ns, args)
        })
      }
    }
  })
}

export const api = new Proxy({} as AppApi, {
  get(_target, prop) {
    if (client) {
      const val = (client as unknown as Record<string | symbol, unknown>)[prop]
      if (typeof val === 'function') return val.bind(client)
      return val
    }

    return lazyAccess(String(prop))
  }
})
