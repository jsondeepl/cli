// types not required in this test file
import * as fs from 'node:fs'
import { resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultConfig, useConfigLoader } from '../src/config.js'

vi.mock('node:fs')
vi.mock('pathe')
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    prompt: vi.fn(),
  },
}))

vi.mock('../src/utils.js', () => ({
  ensureDirectoryExistence: vi.fn(),
  validateDeeplApiKey: vi.fn(),
}))

describe('useConfigLoader - missing fields coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    process.env.DEEPL_API_KEY = 'test-key'
  })

  it('exits when source is missing', async () => {
    const cfg: any = { ...defaultConfig }
    delete cfg.source

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cfg))
    vi.mocked(resolve).mockImplementation(path => path)

    try {
      await useConfigLoader()
    }
    catch {
      // ignore
    }

    const { consola } = await import('consola')
    expect(consola.error).toHaveBeenCalledWith('Configuration is missing the source language.')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('exits when target is missing', async () => {
    const cfg: any = { ...defaultConfig }
    delete cfg.target

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cfg))
    vi.mocked(resolve).mockImplementation(path => path)

    try {
      await useConfigLoader()
    }
    catch {
    }

    const { consola } = await import('consola')
    expect(consola.error).toHaveBeenCalledWith('Configuration is missing the target languages.')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('exits when langDir is missing', async () => {
    const cfg: any = { ...defaultConfig }
    delete cfg.langDir

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cfg))
    vi.mocked(resolve).mockImplementation(path => path)

    try {
      await useConfigLoader()
    }
    catch {
    }

    const { consola } = await import('consola')
    expect(consola.error).toHaveBeenCalledWith('Configuration is missing the language directory.')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('exits when apiKey is missing', async () => {
    const cfg: any = { ...defaultConfig }
    delete cfg.apiKey
    // Ensure environment variable is not set to simulate missing API key
    delete process.env.DEEPL_API_KEY
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cfg))
    vi.mocked(resolve).mockImplementation(path => path)

    try {
      await useConfigLoader()
    }
    catch {
    }

    const { consola } = await import('consola')
    expect(consola.error).toHaveBeenCalledWith(
      'DEEPL_API_KEY environment variable is not set. Get a free key at https://www.deepl.com/en/your-account/keys',
    )
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('warns when options is missing but proceeds', async () => {
    const cfg: any = { ...defaultConfig }
    delete cfg.options

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cfg))
    const { validateDeeplApiKey } = await import('../src/utils.js')
    vi.mocked(validateDeeplApiKey).mockResolvedValue({} as any)
    vi.mocked(resolve).mockImplementation(path => path)

    const result = await useConfigLoader()

    const { consola } = await import('consola')
    expect(consola.warn).toHaveBeenCalledWith('Configuration is missing the options object. Using default options.')
    expect(result).toBeDefined()
    expect(result.options).toEqual(defaultConfig.options)
  })
})
