import * as fs from 'node:fs'
import { resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureDirectoryExistence,
  extractUniqueKeys,
  formattedNewDate,
  mergeFiles,
  parseJsonFile,
  useCount,
} from '../src/utils.js'

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('pathe', async () => {
  const actual = await vi.importActual('pathe')
  return {
    ...actual,
    resolve: vi.fn(),
    dirname: vi.fn().mockReturnValue('/path/to'),
  }
})

describe('jsonDeepL CLI utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractUniqueKeys', () => {
    it('should extract new keys that do not exist in old object', async () => {
      const newJson = { key1: 'value1', key2: 'value2' }
      const oldJson = { key1: 'value1' }

      const result = await extractUniqueKeys(newJson, oldJson)

      expect(result).toEqual({ key2: 'value2' })
    })

    it('should extract changed values for existing keys', async () => {
      const newJson = { key1: 'new_value', key2: 'unchanged' }
      const oldJson = { key1: 'old_value', key2: 'unchanged' }

      const result = await extractUniqueKeys(newJson, oldJson)

      expect(result).toEqual({ key1: 'new_value' })
    })

    it('should handle nested objects recursively', async () => {
      const newJson = {
        level1: {
          level2: {
            key1: 'new_value',
            key2: 'same_value',
          },
          new_key: 'added',
        },
      }
      const oldJson = {
        level1: {
          level2: {
            key1: 'old_value',
            key2: 'same_value',
          },
        },
      }

      const result = await extractUniqueKeys(newJson, oldJson)

      expect(result).toEqual({
        level1: {
          level2: {
            key1: 'new_value',
          },
          new_key: 'added',
        },
      })
    })

    it('should return empty object when no unique keys exist', async () => {
      const newJson = { key1: 'value1', key2: 'value2' }
      const oldJson = { key1: 'value1', key2: 'value2' }

      const result = await extractUniqueKeys(newJson, oldJson)

      expect(result).toEqual({})
    })
  })

  describe('mergeFiles', () => {
    it('should merge objects giving priority to source values', async () => {
      const target = { key1: 'old_value', key2: 'target_only' }
      const source = { key1: 'new_value', key3: 'source_only' }

      const result = await mergeFiles(target, source)

      expect(result).toEqual({
        key1: 'new_value',
        key2: 'target_only',
        key3: 'source_only',
      })
    })

    it('should handle nested object merging', async () => {
      const target = {
        level1: {
          existing: 'keep',
          override: 'old',
        },
        keep_this: 'intact',
      }
      const source = {
        level1: {
          override: 'new',
          added: 'value',
        },
      }

      const result = await mergeFiles(target, source)

      expect(result).toEqual({
        level1: {
          existing: 'keep',
          override: 'new',
          added: 'value',
        },
        keep_this: 'intact',
      })
    })
  })

  describe('useCount', () => {
    it('should count characters in string values', async () => {
      const obj = { key1: 'hello', key2: 'world' }

      const result = await useCount(obj)

      expect(result).toBe(10) // 'hello' (5) + 'world' (5)
    })

    it('should count characters recursively in nested objects', async () => {
      const obj = {
        level1: {
          level2: {
            text1: 'abc',
            text2: 'def',
          },
          text3: 'ghi',
        },
        text4: 'jkl',
      }

      const result = await useCount(obj)

      expect(result).toBe(12) // 3 + 3 + 3 + 3
    })

    it('should ignore non-string values', async () => {
      const obj: any = {
        text: 'hello',
        number: 123,
        boolean: true,
        null_val: null,
      }

      const result = await useCount(obj)

      expect(result).toBe(5) // Only 'hello'
    })
  })

  describe('parseJsonFile', () => {
    it('should return empty object when file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(resolve).mockReturnValue('/path/to/en.json')

      const result = await parseJsonFile('./locales', 'en')

      expect(result).toEqual({})
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/en.json')
    })

    it('should parse and return JSON data when file exists', async () => {
      const mockData = { key: 'value' }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(resolve).mockReturnValue('/path/to/en.json')
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(mockData))

      const result = await parseJsonFile('./locales', 'en')

      expect(result).toEqual(mockData)
      expect(fs.promises.readFile).toHaveBeenCalledWith('/path/to/en.json', 'utf8')
    })
  })

  describe('ensureDirectoryExistence', () => {
    it('should create directory when it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      await ensureDirectoryExistence('/path/to/file.json')

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true })
    })

    it('should not create directory when it already exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      await ensureDirectoryExistence('/path/to/file.json')

      expect(fs.mkdirSync).not.toHaveBeenCalled()
    })
  })

  describe('formattedNewDate', () => {
    it('should return formatted date string with timestamp', () => {
      const mockDate = new Date('2023-10-07T15:30:00.000Z')
      vi.setSystemTime(mockDate)

      const result = formattedNewDate()

      expect(result).toMatch(/^\d+_D[\d_]+_T[\d_]+(_[AP]M)?$/)
      expect(result).toContain('1696692600') // Unix timestamp for the mock date
    })
  })
})
