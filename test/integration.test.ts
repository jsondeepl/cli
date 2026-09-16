import type { Config } from '../src/types/common.types.js'
import * as fs from 'node:fs'
import { resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCleanup,
  useDeeplUsage,
  useExtract,
  useMerging,
  useTranslateJSON,
} from '../src/utils.js'

const { mockTranslateText, mockGetUsage } = vi.hoisted(() => ({
  mockTranslateText: vi.fn(),
  mockGetUsage: vi.fn(),
}))

// Mock external dependencies
vi.mock('node:fs')
vi.mock('pathe')
vi.mock('deepl-node', () => ({
  Translator: class {
    translateText = mockTranslateText
    getUsage = mockGetUsage
  },
  AuthorizationError: class AuthorizationError extends Error {},
  QuotaExceededError: class QuotaExceededError extends Error {},
  TooManyRequestsError: class TooManyRequestsError extends Error {},
  ConnectionError: class ConnectionError extends Error {},
}))
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

describe('integration workflow', () => {
  const mockConfig: Config = {
    source: 'en',
    target: ['fr', 'es'],
    langDir: './test/fixtures',
    apiKey: 'test-api-key',
    formality: 'prefer_less',
    options: {
      prompt: false,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  })

  describe('useExtract', () => {
    it('should extract new and changed keys from source', async () => {
      const sourceData = {
        welcome: 'Welcome to our application',
        navigation: { home: 'Home', about: 'About', contact: 'Contact' },
        newKey: 'This is new',
      }

      const lockData = {
        welcome: 'Welcome to our application',
        navigation: { home: 'Home', about: 'About' },
      }

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(resolve).mockReturnValue('/path/to/en-lock.json')
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(lockData))

      const result = await useExtract('en', sourceData)

      expect(result).toEqual({
        navigation: { contact: 'Contact' },
        newKey: 'This is new',
      })
    })

    it('should return all data when no lock file exists', async () => {
      const sourceData = { key: 'value' }

      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(resolve).mockReturnValue('/path/to/en-lock.json')

      const result = await useExtract('en', sourceData)

      expect(result).toEqual(sourceData)
    })
  })

  describe('useTranslateJSON', () => {
    it('should translate keys for all target languages via DeepL', async () => {
      const uniqueKeys = { newKey: 'Hello world' }

      // Create per-language payloads Map
      const perLanguagePayloads = new Map<string, any>()
      perLanguagePayloads.set('fr', uniqueKeys)
      perLanguagePayloads.set('es', uniqueKeys)

      mockTranslateText.mockResolvedValue([{ text: 'Bonjour le monde' }])
      vi.mocked(resolve).mockImplementation(path => path)

      const result = await useTranslateJSON(perLanguagePayloads, mockConfig)

      expect(mockTranslateText).toHaveBeenCalledTimes(2) // fr and es
      expect(mockTranslateText).toHaveBeenCalledWith(
        ['Hello world'],
        'en',
        'fr',
        expect.objectContaining({ formality: 'prefer_less' }),
      )
      expect(result).toMatch(/^\d+_D[\d_]+_T[\d_]+(_[AP]M)?$/)
    })

    it('should handle DeepL errors gracefully', async () => {
      const { consola } = await import('consola')
      const uniqueKeys = { key: 'value' }

      // Create per-language payloads Map
      const perLanguagePayloads = new Map<string, any>()
      perLanguagePayloads.set('fr', uniqueKeys)
      perLanguagePayloads.set('es', uniqueKeys)

      mockTranslateText.mockRejectedValue(new Error('Translation Error'))

      await useTranslateJSON(perLanguagePayloads, mockConfig)

      expect(consola.error).toHaveBeenCalledWith('Error during translation:', expect.any(Error))
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('useMerging', () => {
    it('should merge translations with existing locale files, removing stale keys', async () => {
      const dateTime = '1696690200_D10_07_2023_T15_30_00_PM'

      // Source has 'existing' and 'newKey', but not 'stale' — 'stale' should be
      // removed from the merged fr.json now that cleanup runs as part of the merge.
      const sourceData = { existing: 'Existing', newKey: 'New key' }
      const existingFr = { existing: 'Existant', stale: 'Obsolète' }
      const newTranslationsFr = { newKey: 'Nouvelle clé' }

      vi.mocked(resolve).mockImplementation((path) => {
        if (path.includes('history'))
          return `/history/${dateTime}`
        return '/locales'
      })

      // mockConfig.target is ['fr', 'es']; useMerging reads: source once, then
      // old-state + new-state per target language, in that order.
      const readSequence = [
        JSON.stringify(sourceData),
        JSON.stringify(existingFr),
        JSON.stringify(newTranslationsFr),
        JSON.stringify({}),
        JSON.stringify({}),
      ]
      let callIndex = 0
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.promises.readFile).mockImplementation(() =>
        Promise.resolve(readSequence[callIndex++] ?? '{}'))

      await useMerging(mockConfig, dateTime)

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/locales/fr.json',
        JSON.stringify({ existing: 'Existant', newKey: 'Nouvelle clé' }, null, 2),
        'utf8',
      )
    })
  })

  describe('useDeeplUsage', () => {
    it('should proceed when usage is within limits and no prompt is required', async () => {
      const { consola } = await import('consola')

      mockGetUsage.mockResolvedValue({
        character: { count: 100, limit: 500_000 },
        anyLimitReached: () => false,
      })

      await useDeeplUsage('test-api-key', 1000, false)

      expect(consola.info).toHaveBeenCalledWith(
        expect.stringContaining('100 / 500,000 characters used'),
      )
      expect(consola.prompt).not.toHaveBeenCalled()
      expect(process.exit).not.toHaveBeenCalled()
    })

    it('should warn when the translation may exceed the remaining quota', async () => {
      const { consola } = await import('consola')

      mockGetUsage.mockResolvedValue({
        character: { count: 499_500, limit: 500_000 },
        anyLimitReached: () => false,
      })

      await useDeeplUsage('test-api-key', 1000, false)

      expect(consola.warn).toHaveBeenCalledWith(
        expect.stringContaining('may exceed your remaining DeepL quota'),
      )
    })

    it('should cancel when the user declines the confirmation prompt', async () => {
      const { consola } = await import('consola')

      mockGetUsage.mockResolvedValue({
        character: { count: 100, limit: 500_000 },
        anyLimitReached: () => false,
      })
      vi.mocked(consola.prompt).mockResolvedValue(false)

      await useDeeplUsage('test-api-key', 1000, true)

      expect(consola.prompt).toHaveBeenCalledWith('Do you want to proceed with the translation?', {
        type: 'confirm',
      })
      expect(process.exit).toHaveBeenCalledWith(0)
    })
  })

  describe('useCleanup', () => {
    it('should remove keys that do not exist in source', async () => {
      const sourceData = { keepThis: 'value' }
      const targetData = { keepThis: 'valeur', removeThis: 'à supprimer' }

      let parseCallCount = 0
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.promises.readFile).mockImplementation(() => {
        parseCallCount++
        if (parseCallCount === 1)
          return Promise.resolve(JSON.stringify(sourceData))
        return Promise.resolve(JSON.stringify(targetData))
      })

      await useCleanup('./locales', mockConfig)

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        './locales/fr.json',
        JSON.stringify({ keepThis: 'valeur' }, null, 2),
        'utf8',
      )
    })
  })
})
