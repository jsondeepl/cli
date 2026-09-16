import type { Config } from '../src/types/common.types.js'
import * as fs from 'node:fs'
import { resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultConfig, useConfigLoader } from '../src/config.js'

// Mock dependencies
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

// Mock utils
vi.mock('../src/utils.js', () => ({
  ensureDirectoryExistence: vi.fn(),
  validateDeeplApiKey: vi.fn(),
}))

describe('configuration system', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset process.exit mock
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  })

  describe('defaultConfig', () => {
    it('should have valid default configuration structure', () => {
      expect(defaultConfig).toHaveProperty('source', 'en')
      expect(defaultConfig).toHaveProperty('target')
      expect(defaultConfig).toHaveProperty('langDir', './i18n/locales')
      // API key is provided via environment variable at runtime, not in defaultConfig
      expect(defaultConfig).not.toHaveProperty('apiKey')
      expect(defaultConfig).toHaveProperty('formality', 'prefer_less')
      expect(defaultConfig).toHaveProperty('options')
      expect(defaultConfig.options).toHaveProperty('prompt', true)
    })

    it('should include common target languages', () => {
      expect(defaultConfig.target).toContain('fr')
      expect(defaultConfig.target).toContain('es')
      expect(defaultConfig.target).toContain('de')
      expect(defaultConfig.target).toContain('en-GB')
      expect(defaultConfig.target).toContain('pt-BR')
    })
  })

  describe('useConfigLoader', () => {
    it('should create default config when file does not exist', async () => {
      const { consola } = await import('consola')
      const { ensureDirectoryExistence } = await import('../src/utils.js')

      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (path.toString().includes('config.json'))
          return false
        if (path.toString().includes('history'))
          return false
        return true
      })
      vi.mocked(consola.prompt).mockResolvedValue(true)
      vi.mocked(resolve).mockImplementation(path => path)

      await expect(useConfigLoader()).rejects.toThrow()

      expect(consola.warn).toHaveBeenCalledWith('Configuration file not found: jsondeepl/config.json')
      expect(ensureDirectoryExistence).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'jsondeepl/config.json',
        JSON.stringify(defaultConfig, null, 2),
        'utf8',
      )
      expect(process.exit).toHaveBeenCalledWith(0)
    })

    it('should validate existing config file and validate the DeepL API key', async () => {
      const mockConfig: Config = {
        source: 'en',
        target: ['fr', 'es'],
        langDir: './locales',
        apiKey: 'test-key',
        formality: 'prefer_less',
        options: { prompt: false },
      }

      const { validateDeeplApiKey } = await import('../src/utils.js')

      // Provide API key via environment variable as useConfigLoader expects
      process.env.DEEPL_API_KEY = 'test-key'

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig))
      vi.mocked(validateDeeplApiKey).mockResolvedValue({} as any)
      vi.mocked(resolve).mockImplementation(path => path)

      const result = await useConfigLoader()

      expect(result).toEqual({ ...mockConfig, usage: {} })
      expect(validateDeeplApiKey).toHaveBeenCalledWith('test-key')
    })

    it('should exit when the DEEPL_API_KEY environment variable is missing', async () => {
      const mockConfig: any = { ...defaultConfig }
      delete mockConfig.apiKey
      delete process.env.DEEPL_API_KEY

      const { consola } = await import('consola')

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig))
      vi.mocked(resolve).mockImplementation(path => path)

      try {
        await useConfigLoader()
      }
      catch {
        // Expected to throw due to process.exit mock
      }

      expect(consola.error).toHaveBeenCalledWith(
        'DEEPL_API_KEY environment variable is not set. Get a free key at https://www.deepl.com/en/your-account/keys',
      )
      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('should exit when the DeepL API key is invalid', async () => {
      const mockConfig: Config = {
        source: 'en',
        target: ['fr'],
        langDir: './locales',
        apiKey: 'invalid-key',
        options: { prompt: false },
      }

      const { validateDeeplApiKey } = await import('../src/utils.js')

      process.env.DEEPL_API_KEY = 'invalid-key'

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig))
      // validateDeeplApiKey exits the process itself on an invalid key
      vi.mocked(validateDeeplApiKey).mockImplementation(async () => {
        process.exit(1)
      })
      vi.mocked(resolve).mockImplementation(path => path)

      try {
        await useConfigLoader()
      }
      catch {
        // Expected to throw due to process.exit mock
      }

      expect(validateDeeplApiKey).toHaveBeenCalledWith('invalid-key')
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })
})
