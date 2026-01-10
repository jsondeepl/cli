import * as fs from 'node:fs'
import { resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLockFile, useCleanup, useStateCheck, validateJsonFileObject } from '../src/utils.js'

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
        options: { autoMerge: true, prompt: false },
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
})
