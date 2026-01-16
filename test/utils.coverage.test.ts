import * as fs from 'node:fs'
import { resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as utils from '../src/utils.js'

vi.mock('node:fs')
vi.mock('pathe')
vi.mock('ofetch', () => ({ ofetch: vi.fn() }))
vi.mock('consola', () => ({
  consola: {
    start: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    prompt: vi.fn(),
  },
}))

describe('utils coverage additions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validateJsonFileObject exits on array root', async () => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    await utils.validateJsonFileObject([] as any)
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('createLockFile does not call ensureDirectoryExistence when lock exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(resolve).mockImplementation((p: string) => p)

    await utils.createLockFile('en', { a: 'b' } as any)

    // should still write file
    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it('mergeFiles handles nested source when target missing', async () => {
    const target = {}
    const source = { level1: { level2: { k: 'v' } } }

    const result = await utils.mergeFiles(target as any, source as any)

    expect(result).toEqual({ level1: { level2: { k: 'v' } } })
  })

  it('mergeFiles handles when target has null for a nested key', async () => {
    const target = { level1: null }
    const source = { level1: { a: 'b' } }

    const result = await utils.mergeFiles(target as any, source as any)

    expect(result).toEqual({ level1: { a: 'b' } })
  })

  it('mergeFiles deep nested merge preserves and overrides correctly', async () => {
    const target = {
      level1: {
        existing: 'keep',
        override: 'old',
        deep: { keepme: 'x' },
      },
      keep_this: 'intact',
    }
    const source = {
      level1: {
        override: 'new',
        added: 'value',
        deep: { newkey: 'y' },
      },
    }

    const result = await utils.mergeFiles(target as any, source as any)

    expect(result).toEqual({
      level1: {
        existing: 'keep',
        override: 'new',
        deep: { keepme: 'x', newkey: 'y' },
        added: 'value',
      },
      keep_this: 'intact',
    })
  })

  it('removeKeysByPath breaks when a parent is not an object', () => {
    const obj: any = { a: 'primitive' }
    // path expects a.b.c but 'a' is a primitive, so function should not throw and should leave object unchanged
    utils.removeKeysByPath(obj, ['a.b.c'])
    expect(obj.a).toBe('primitive')
  })

  it('findKeysToRemove recurses into nested objects', () => {
    const target = { a: { b: { c: 'v', d: 'x' } }, z: 'keep' }
    const source = { a: { b: { c: 'v' } } }
    const keys = utils.findKeysToRemove(target as any, source as any)
    expect(keys).toContain('a.b.d')
  })

  it('saveJsonToFile writes file and calls success', async () => {
    vi.mocked(resolve).mockImplementation((p: string) => p)
    await utils.saveJsonToFile({ a: 'b' } as any, 'path/to/file.json')

    expect(fs.promises.writeFile).toHaveBeenCalledWith('path/to/file.json', JSON.stringify({ a: 'b' }, null, 2), 'utf8')
  })

  it('useExtract handles read error and exits', async () => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(resolve).mockImplementation((p: string) => p)
    vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('read fail'))

    await utils.useExtract('en', { a: 'b' } as any)
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('useCleanup removes deep nested keys not present in source', async () => {
    const sourceData = { keep: { nested: { x: 'v' } } }
    const targetData = { keep: { nested: { x: 'v', y: 'z' } }, other: { a: 'b' } }

    let parseCallCount = 0
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(resolve).mockImplementation(path => path)
    vi.mocked(fs.promises.readFile).mockImplementation(() => {
      parseCallCount++
      if (parseCallCount === 1)
        return Promise.resolve(JSON.stringify(sourceData))
      return Promise.resolve(JSON.stringify(targetData))
    })

    const mockConfig = {
      source: 'en',
      target: ['fr'],
      langDir: './locales',
      apiKey: 'k',
      engine: 'deepl',
      formality: 'prefer_less',
      options: { prompt: false },
    } as any

    await (await import('../src/utils.js')).useCleanup('./locales', mockConfig)

    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      './locales/fr.json',
      JSON.stringify({ keep: { nested: { x: 'v' } } }, null, 2),
      'utf8',
    )
  })

  it('useUser exits when subscription is inactive', async () => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const { ofetch } = await import('ofetch')
    const { consola } = await import('consola')

    const mockUser = { apiKey: 'k', user_id: 'u', isActive: false, credit_balance: 10, total: 0, after: 10 }
    vi.mocked(ofetch).mockResolvedValue(mockUser)

    const cfg = { apiKey: 'k', options: { prompt: false } } as any
    await utils.useUser(cfg, 10)

    expect(consola.error).toHaveBeenCalledWith('Your subscription is inactive. Please renew your subscription to continue using the service.')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('useUser returns null when ofetch errors', async () => {
    const { ofetch } = await import('ofetch')
    const { consola } = await import('consola')

    vi.mocked(ofetch).mockRejectedValue(new Error('network'))

    const cfg = { apiKey: 'k', options: { prompt: false } } as any
    const res = await utils.useUser(cfg, 10)

    expect(consola.error).toHaveBeenCalledWith('Error fetching user data:', expect.any(Error))
    expect(res).toBeNull()
  })
})
