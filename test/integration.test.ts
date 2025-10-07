import type { ConfigOptions } from '../src/types/common.types.js'
import * as fs from 'node:fs'
import { resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCleanup,
  useExtract,
  useMerging,
  useTranslateJSON,
  useUserCredit,
} from '../src/utils.js'

// Mock external dependencies
vi.mock('node:fs')
vi.mock('pathe')
vi.mock('ofetch', () => ({
  ofetch: vi.fn(),
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
  const mockConfig: ConfigOptions = {
    source: 'en',
    target: ['fr', 'es'],
    langDir: './test/fixtures',
    apiKey: 'test-api-key',
    engine: 'deepl',
    formality: 'prefer_less',
    options: {
      autoMerge: true,
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
    it('should translate keys for all target languages', async () => {
      const { ofetch } = await import('ofetch')
      const uniqueKeys = { newKey: 'Hello world' }

      const mockTranslation = { newKey: 'Bonjour le monde' }
      vi.mocked(ofetch).mockResolvedValue(mockTranslation)
      vi.mocked(resolve).mockImplementation(path => path)

      const result = await useTranslateJSON(uniqueKeys, mockConfig)

      expect(ofetch).toHaveBeenCalledTimes(2) // fr and es
      expect(ofetch).toHaveBeenCalledWith(
        'https://api.jsondeepl.com/v1/cli',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            json: uniqueKeys,
            src: 'en',
            to: 'fr',
            formality: 'prefer_less',
            apiKey: 'test-api-key',
          }),
        }),
      )
      expect(result).toMatch(/^\d+_D\d+_\d+_\d+_T\d+_\d+_\d+$/)
    })

    it('should handle API errors gracefully', async () => {
      const { ofetch } = await import('ofetch')
      const { consola } = await import('consola')
      const uniqueKeys = { key: 'value' }

      vi.mocked(ofetch).mockRejectedValue(new Error('API Error'))

      await useTranslateJSON(uniqueKeys, mockConfig)

      expect(consola.error).toHaveBeenCalledWith('Error during translation:', expect.any(Error))
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('useMerging', () => {
    it('should merge translations with existing locale files', async () => {
      const dateTime = '1696690200_D10_07_2023_T15_30_00_PM'

      const existingFr = { existing: 'Existant' }
      const newTranslationsFr = { newKey: 'Nouvelle clé' }

      vi.mocked(resolve).mockImplementation((path) => {
        if (path.includes('history'))
          return `/history/${dateTime}`
        return '/locales'
      })

      // Mock parseJsonFile calls
      let callCount = 0
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.promises.readFile).mockImplementation(() => {
        callCount++
        if (callCount % 2 === 1) {
          return Promise.resolve(JSON.stringify(existingFr))
        }
        return Promise.resolve(JSON.stringify(newTranslationsFr))
      })

      await useMerging(mockConfig, dateTime)

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/locales/fr.json',
        JSON.stringify({ existing: 'Existant', newKey: 'Nouvelle clé' }, null, 2),
        'utf8',
      )
    })
  })

  describe('useUserCredit', () => {
    it('should proceed when user has sufficient credits', async () => {
      const { ofetch } = await import('ofetch')
      const { consola } = await import('consola')

      const mockCreditResponse = {
        balance: 100,
        total: 10,
        after: 90,
      }

      vi.mocked(ofetch).mockResolvedValue(mockCreditResponse)

      await useUserCredit(mockConfig, 1000)

      expect(ofetch).toHaveBeenCalledWith(
        'https://api.jsondeepl.com/v1/cli-user-credit',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            apiKey: 'test-api-key',
            characters: 1000,
          }),
        }),
      )
      expect(consola.success).toHaveBeenCalledWith('You have $100 credits available.')
    })

    it('should exit when user has insufficient credits', async () => {
      const { ofetch } = await import('ofetch')
      const { consola } = await import('consola')

      const mockCreditResponse = {
        balance: 5,
        total: 10,
        after: -5,
      }

      vi.mocked(ofetch).mockResolvedValue(mockCreditResponse)

      await useUserCredit(mockConfig, 1000)

      expect(consola.error).toHaveBeenCalledWith('You do not have enough credits for this translation.')
      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('should prompt user when prompt option is enabled', async () => {
      const { ofetch } = await import('ofetch')
      const { consola } = await import('consola')

      const configWithPrompt = { ...mockConfig, options: { ...mockConfig.options, prompt: true } }
      const mockCreditResponse = { balance: 100, total: 10, after: 90 }

      vi.mocked(ofetch).mockResolvedValue(mockCreditResponse)
      vi.mocked(consola.prompt).mockResolvedValue(false)

      await useUserCredit(configWithPrompt, 1000)

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
