import type {
  AiLangCodes,
  Config,
  JsonFileObject,
  SourceLanguageCode,
  TargetLanguageCode,
  UseUser,
} from './types/common.types.ts'
import * as fs from 'node:fs'
import process from 'node:process'
import { consola } from 'consola'
import { ofetch } from 'ofetch'
import { dirname, join, resolve } from 'pathe'

// #region 📂 Common Utility Functions

/**
 * Ensures that the directory containing a file exists.
 * @param {string} filePath - Path to the file.
 * @returns {boolean} - True if the directory exists or was created successfully, otherwise creates the necessary directory.
 */
export async function ensureDirectoryExistence(filePath: string): Promise<void> {
  const directoryName = dirname(filePath)
  if (!fs.existsSync(directoryName)) {
    fs.mkdirSync(directoryName, { recursive: true })
  }
}

/**
 * Parses a JSON file and returns the data as an object.
 * @param {string} langDir - Path to the directory containing the language files.
 * @param {string} lang - Language code of the file to parse.
 * @returns {Promise<Record<string, string>>} - A promise that resolves to the parsed JSON data.
 * @throws {Error} - If the file cannot be read or parsed.
 */
export async function parseJsonFile(
  langDir: string,
  lang: AiLangCodes | SourceLanguageCode | TargetLanguageCode,
): Promise<Record<string, string>> {
  const filePath = resolve(langDir, `${lang}.json`)
  if (!fs.existsSync(filePath)) {
    return {}
  }
  const fileData = await fs.promises.readFile(filePath, 'utf8')
  return JSON.parse(fileData)
}

export async function validateJsonFileObject(obj: any): Promise<void> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    consola.error('Invalid JSON file format: Root element must be an object.')
    process.exit(1)
  }
  await checkNoArrays(obj)
}

async function checkNoArrays(o: any): Promise<void> {
  for (const key in o) {
    if (Array.isArray(o[key])) {
      consola.error(`Invalid JSON file format: Arrays are not allowed (found at key: ${key}).`)
      process.exit(1)
    }
    else if (o[key] && typeof o[key] === 'object') {
      await checkNoArrays(o[key])
    }
  }
}
// #endregion 📂 Common Utility Functions

export async function useStateCheck(src_locale: string, sourceData: Record<string, string>): Promise<void> {
  // format current dateTime for the history directory name and lastJob option value
  const dateTime = formattedNewDate()

  // historyPath is used to store each translation job history
  const historySourcePath = join('jsondeepl', 'history', `${dateTime}`, `${src_locale}.json`)
  // const historyDirPath = join('jsondeepl', 'history', `${dateTime}`)

  // the last state of the locale files (this will be used to determine unique keys)
  const lastStateSourcePath = resolve(`jsondeepl/${src_locale}-lock.json`)
  ensureDirectoryExistence(lastStateSourcePath)
  ensureDirectoryExistence(historySourcePath)
  const lastStateExists = fs.existsSync(lastStateSourcePath)
  if (!lastStateExists) {
    consola.start(`Creating jsondeepl/${src_locale}-lock.json for future translation reference...`)
    fs.writeFileSync(lastStateSourcePath, JSON.stringify(sourceData, null, 2))
    fs.writeFileSync(historySourcePath, JSON.stringify(sourceData, null, 2))
    consola.success(`${lastStateSourcePath} created successfully.`)
    // jsonData = initialJsonData
  }
}

/**
 * Checks which target languages are missing and returns them.
 * @param {string} langDir - Path to the directory containing the language files.
 * @param {string[]} targetLanguages - Array of target language codes.
 * @returns {Promise<string[]>} - Array of missing target language codes.
 */
export async function detectMissingTargetLanguages(
  langDir: string,
  targetLanguages: string[],
): Promise<string[]> {
  const missingLanguages: string[] = []

  for (const lang of targetLanguages) {
    const filePath = resolve(langDir, `${lang}.json`)
    if (!fs.existsSync(filePath)) {
      missingLanguages.push(lang)
    }
  }

  return missingLanguages
}

/**
 * Creates per-language translation payloads based on whether the language needs full or partial translation.
 * @param {string} langDir - Path to the directory containing the language files.
 * @param {SourceLanguageCode} src_locale - Source locale code.
 * @param {JsonFileObject} sourceData - Source data object.
 * @param {JsonFileObject} extractedKeys - Extracted unique keys from source.
 * @param {TargetLanguageCode[]} targetLanguages - Array of target language codes.
 * @returns {Promise<Map<string, JsonFileObject>>} - Map of language code to data that needs translation.
 */
export async function createPerLanguagePayloads(
  langDir: string,
  src_locale: SourceLanguageCode,
  sourceData: JsonFileObject,
  extractedKeys: JsonFileObject,
  targetLanguages: TargetLanguageCode[],
): Promise<Map<string, JsonFileObject>> {
  const payloads = new Map<string, JsonFileObject>()
  const missingLanguages = await detectMissingTargetLanguages(langDir, targetLanguages)

  for (const lang of targetLanguages) {
    if (missingLanguages.includes(lang)) {
      // New language - translate everything
      consola.info(`Detected new target language: ${lang} - will translate all keys`)
      payloads.set(lang, sourceData)
    }
    else {
      // Existing language - translate only changed keys
      payloads.set(lang, extractedKeys)
    }
  }

  return payloads
}

/**
 * Extracts unique keys from the source data based on the last state of the locale files.
 * @param {string} src_locale - Source locale code.
 * @param {object} sourceData - Source data object.
 * @returns {Promise<JsonFileObject>} - A promise that resolves to an object containing unique keys.
 */
export async function useExtract(
  src_locale: string,
  sourceData: JsonFileObject,
): Promise<JsonFileObject> {
  try {
    consola.start(`extracting unique keys from the last state of the source locale...`)
    const lastStateSourcePath = resolve(`jsondeepl/${src_locale}-lock.json`)
    const lastStateExists = fs.existsSync(lastStateSourcePath)

    if (!lastStateExists) {
      consola.warn(`No last state found for ${src_locale}.json.`)
      return sourceData
    }

    const lastStateData = await fs.promises.readFile(lastStateSourcePath, 'utf8')
    const lastStateJsonData = JSON.parse(lastStateData)
    const uniqueKeys = await extractUniqueKeys(sourceData, lastStateJsonData)
    return uniqueKeys
  }
  catch (error) {
    consola.error(`Error extracting unique keys for ${src_locale}:`, error)
    consola.warn('Falling back to using all source data')
    process.exit(1)
  }
}

/**
 * Extracts unique keys from two objects.
 * @param {object} newJson - First object.
 * @param {object} oldJson - Second object.
 * @returns {object} - Object containing unique keys from the two input objects.
 */
export async function extractUniqueKeys(
  newJson: JsonFileObject,
  oldJson: JsonFileObject,
): Promise<JsonFileObject> {
  const uniqueKeys: JsonFileObject = {}

  for (const key in newJson) {
    if (Object.hasOwn(newJson, key)) {
      // Check if both have the key
      if (Object.hasOwn(oldJson, key)) {
        if (typeof newJson[key] === 'object' && typeof oldJson[key] === 'object') {
          // Recurse into sub-objects
          const result = await extractUniqueKeys(newJson[key], oldJson[key])
          if (Object.keys(result).length > 0) {
            uniqueKeys[key] = result
          }
        }
        else if (newJson[key] !== oldJson[key]) {
          // If values are not equal, add to uniqueKeys
          uniqueKeys[key] = newJson[key] as string
        }
      }
      else {
        // If oldJson does not have the key, add it from newJson
        uniqueKeys[key] = newJson[key] as JsonFileObject
      }
    }
  }
  return uniqueKeys
}

/**
 * Formats the current date and time to be used as a safe and readable directory or file name.
 * Adds 'D' before the date and 'T' before the time.
 */
export function formattedNewDate(): string {
  const now = new Date()
  const dateParts = now.toLocaleString().split(', ')
  const timestamp = Math.floor(now.getTime() / 1000)
  const formattedDate = `D${(dateParts[0] ?? '').replace(/[/\\: ]/g, '_')}`
  const formattedTime = `T${(dateParts[1] ?? '').replace(/[/\\: ]/g, '_')}`
  return `${timestamp}_${formattedDate}_${formattedTime}`
}

// This function counts the number of characters in the object and its nested objects
export async function useCount(obj: JsonFileObject): Promise<number> {
  let sum = 0
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      sum += obj[key].length
    }
    else if (typeof obj[key] === 'object') {
      sum += await useCount(obj[key])
    }
  }
  return sum
}

/**
 * Counts total characters across all per-language payloads.
 * @param {Map<string, JsonFileObject>} perLanguagePayloads - Map of language code to data.
 * @returns {Promise<number>} - Total character count across all languages.
 */
export async function useCountPerLanguage(perLanguagePayloads: Map<string, JsonFileObject>): Promise<number> {
  let totalCharacters = 0

  for (const [lang, data] of perLanguagePayloads) {
    const charCount = await useCount(data)
    consola.info(`${lang}: ${charCount} characters`)
    totalCharacters += charCount
  }

  return totalCharacters
}

// translation function with per-language payload support
export async function useTranslateJSON(
  perLanguagePayloads: Map<string, JsonFileObject>,
  config: Config,
): Promise<string> {
  const dateTime = formattedNewDate()
  try {
    for (const targetLanguage of config.target) {
      const jsonToTranslate = perLanguagePayloads.get(targetLanguage) || {}

      // Skip if nothing to translate for this language
      if (Object.keys(jsonToTranslate).length === 0) {
        consola.warn(`No keys to translate for ${targetLanguage}, skipping...`)
        continue
      }

      consola.start(`Translating from ${config.source} to ${targetLanguage}...`)
      const translation = await ofetch('https://api.jsondeepl.com/v1/cli', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: jsonToTranslate,
          src: config.source,
          to: targetLanguage,
          formality: config.formality,
          apiKey: config.apiKey,
        }),
      })
      consola.success(`${targetLanguage} Translation Done`)
      await saveJsonToFile(translation, `jsondeepl/history/${dateTime}/${targetLanguage}.json`)
    }
    consola.success('All Translations completed successfully.')
    return dateTime
  }
  catch (error) {
    consola.error('Error during translation:', error)
    consola.error('Translation failed.')
    process.exit(1)
  }
}

// save Json to a file
export async function saveJsonToFile(json: JsonFileObject, filePath: string): Promise<void> {
  await ensureDirectoryExistence(filePath)
  await fs.promises.writeFile(filePath, JSON.stringify(json, null, 2), 'utf8')
  consola.success(`Saved JSON to ${filePath}`)
}

// create a lock file for the source locale
export async function createLockFile(source: string, sourceData: JsonFileObject): Promise<void> {
  const lockFilePath = resolve(`jsondeepl/${source}-lock.json`)
  const hasLockFile = fs.existsSync(lockFilePath)
  if (!hasLockFile) {
    await ensureDirectoryExistence(lockFilePath)
  }
  fs.writeFileSync(lockFilePath, JSON.stringify(sourceData, null, 2), 'utf8')
}

// merge the new translations with the last state
export async function useMerging(config: Config, dateTime: string): Promise<void> {
  const historyDir = resolve(`jsondeepl/history/${dateTime}`)
  const langDir = resolve(config.langDir)
  consola.info(historyDir)

  for (const targetLanguage of config.target) {
    consola.start(`Merging ${targetLanguage}.json`)
    const oldState = await parseJsonFile(langDir, targetLanguage)
    const newState = await parseJsonFile(historyDir, targetLanguage)
    const mergedJson = await mergeFiles(oldState, newState)
    await saveJsonToFile(mergedJson, `${langDir}/${targetLanguage}.json`)
    consola.success(`Merged ${targetLanguage}.json successfully.`)
  }
  consola.success('All Merges completed successfully.')
}

/**
 * Merges two JSON data objects, prioritizing new data entries from the source object.
 * Uses deep merging strategy to preserve non-conflicting entries in nested structures.
 * @param {JsonFileObject} target - The target object which will receive properties.
 * @param {JsonFileObject} source - The source object whose properties will be merged into the target.
 * @returns {JsonFileObject} - A new object containing the deeply merged data.
 */
export async function mergeFiles(
  target: JsonFileObject,
  source: JsonFileObject,
): Promise<JsonFileObject> {
  const merged = { ...target }

  for (const key of Object.keys(source)) {
    const sourceVal = source[key]
    const targetVal = merged[key]

    if (sourceVal && typeof sourceVal === 'object') {
      // Handle nested objects recursively
      merged[key] = await mergeFiles(targetVal as JsonFileObject, sourceVal)
    }
    else {
      // For non-object values, prefer source value if it exists
      merged[key] = sourceVal as string
    }
  }

  return merged
}

/// This function fetches the user data from the API using the provided API key
/// It returns the user data if successful, or null if there was an error.
export async function useUser(config: Config, characterCount: number): Promise<UseUser | null> {
  try {
    const user = await ofetch('https://api.jsondeepl.com/v1/cli-user', {
      method: 'POST',
      body: {
        apiKey: config.apiKey,
        characters: characterCount,
      },
    })
    consola.success(`You have $${user.credit_balance} credits available.`)
    consola.info(`Total characters: ${characterCount} | Cost: $${user.total.toFixed(3)} | Balance after: $${user.after.toFixed(4)}`)

    if (user.isActive === false) {
      consola.error('Your subscription is inactive. Please renew your subscription to continue using the service.')
      process.exit(1)
    }
    if (user.after < 0) {
      consola.error('You do not have enough credits for this translation.')
      process.exit(1)
    }
    if (config.options.prompt) {
      const agreed = await consola.prompt('Do you want to proceed with the translation?', {
        type: 'confirm',
      })
      if (!agreed) {
        consola.info('Translation cancelled.')
        process.exit(0)
      }
    }
    return user
  }
  catch (error) {
    consola.error('Error fetching user data:', error)
    return null
  }
}

export function removeKeysByPath(obj: JsonFileObject, paths: string[]): void {
  for (const path of paths) {
    const parts = path.split('.')
    let current = obj
    const lastPart = parts.pop()!

    // Navigate to the parent object
    for (const part of parts) {
      if (!current[part] || typeof current[part] !== 'object') {
        break
      }
      current = current[part]
    }

    // Delete the key
    if (current && lastPart) {
      delete current[lastPart]
    }
  }
}

export function findKeysToRemove(
  targetJson: JsonFileObject,
  sourceJson: JsonFileObject,
  parentKey: string = '',
): string[] {
  const keysToRemove: string[] = []

  for (const key in targetJson) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key

    if (!Object.hasOwn(sourceJson, key)) {
      keysToRemove.push(fullKey)
    }
    else if (
      typeof targetJson[key] === 'object'
      && targetJson[key] !== null
      && typeof sourceJson[key] === 'object'
      && sourceJson[key] !== null
    ) {
      keysToRemove.push(...findKeysToRemove(targetJson[key], sourceJson[key], fullKey))
    }
  }

  return keysToRemove
}

export async function useCleanup(langDir: string, config: Config): Promise<void> {
  const sourceJsonData = await parseJsonFile(langDir, config.source)

  for (const file of config.target) {
    const jsonData = await parseJsonFile(langDir, file)
    const keysToRemove = findKeysToRemove(jsonData, sourceJsonData)

    // Remove keys that don't exist in source
    removeKeysByPath(jsonData, keysToRemove)

    // Save the cleaned up file
    await saveJsonToFile(jsonData, `${langDir}/${file}.json`)
  }
}
