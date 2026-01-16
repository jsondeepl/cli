import * as fs from 'node:fs'
import { resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLockFile, createPerLanguagePayloads, detectMissingTargetLanguages, useCleanup, useCountPerLanguage, useStateCheck, validateJsonFileObject } from '../src/utils.js'

vi.mock('node:fs')
vi.mock('pathe')
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

describe('utils additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  })

  describe('validateJsonFileObject', () => {
    it('exits when root is not an object', async () => {
      await validateJsonFileObject('not-an-object' as any)
      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('exits when arrays are present nested', async () => {
      const obj = { a: { b: [1, 2, 3] } }
      await validateJsonFileObject(obj as any)
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('useStateCheck', () => {
    it('creates lock and history files when no lock exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(resolve).mockImplementation((p: string) => p)

      await useStateCheck('en', { hello: 'world' } as any)

      expect(fs.writeFileSync).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2)
    })
  })

  describe('useCleanup indirect removal', () => {
    it('removes nested keys that are not in source via useCleanup', async () => {
      const sourceData = { keepThis: 'value' }
      const targetData = { keepThis: 'valeur', removeThis: 'à supprimer' }

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

      await useCleanup('./locales', mockConfig)

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        './locales/fr.json',
        JSON.stringify({ keepThis: 'valeur' }, null, 2),
        'utf8',
      )
    })
  })

  describe('createLockFile', () => {
    it('writes lock file even when it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(resolve).mockImplementation((p: string) => p)

      await createLockFile('en', { hello: 'world' } as any)

      expect(fs.writeFileSync).toHaveBeenCalled()
    })
  })

  describe('detectMissingTargetLanguages', () => {
    it('detects missing target language files', async () => {
      vi.mocked(resolve).mockImplementation((dir: string, file: string) => `${dir}/${file}`)
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        // fr.json exists, es.json doesn't
        return path.includes('fr.json')
      })

      const missing = await detectMissingTargetLanguages('./locales', ['fr', 'es', 'de'])

      expect(missing).toEqual(['es', 'de'])
    })

    it('returns empty array when all languages exist', async () => {
      vi.mocked(resolve).mockImplementation((dir: string, file: string) => `${dir}/${file}`)
      vi.mocked(fs.existsSync).mockReturnValue(true)

      const missing = await detectMissingTargetLanguages('./locales', ['fr', 'es'])

      expect(missing).toEqual([])
    })
  })

  describe('createPerLanguagePayloads', () => {
    it('assigns full source data to new languages and extracted keys to existing', async () => {
      const sourceData = { key1: 'value1', key2: 'value2' }
      const extractedKeys = { key1: 'updated' }

      vi.mocked(resolve).mockImplementation((dir: string, file: string) => `${dir}/${file}`)
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        // Only fr.json exists
        return path.includes('fr.json')
      })

      const payloads = await createPerLanguagePayloads(
        './locales',
        'en',
        sourceData,
        extractedKeys,
        ['fr', 'es'],
      )

      expect(payloads.get('fr')).toEqual(extractedKeys) // existing language gets extracted keys
      expect(payloads.get('es')).toEqual(sourceData) // new language gets full source
    })
  })

  describe('useCountPerLanguage', () => {
    it('counts total characters across all language payloads', async () => {
      const payloads = new Map()
      payloads.set('fr', { key1: 'hello', key2: 'world' }) // 10 chars
      payloads.set('es', { key1: 'hi' }) // 2 chars

      const total = await useCountPerLanguage(payloads)

      expect(total).toBe(12)
    })
  })
})
