import type { Usage } from 'deepl-node'
import type {
  Config,
  JsonFileObject,
  SourceLanguageCode,
  TargetLanguageCode,
} from './types/common.types.ts'
import * as fs from 'node:fs'
import process from 'node:process'
import { consola } from 'consola'
import { AuthorizationError, ConnectionError, QuotaExceededError, TooManyRequestsError, Translator } from 'deepl-node'
import { dirname, resolve } from 'pathe'

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
  lang: SourceLanguageCode | TargetLanguageCode,
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

// #region 🌐 DeepL translation

// Reuse one Translator instance per API key instead of constructing a new one for
// every string/usage call (a run may make hundreds of translation calls per key).
const translatorCache = new Map<string, Translator>()
function getTranslator(apiKey: string): Translator {
  let translator = translatorCache.get(apiKey)
  if (!translator) {
    translator = new Translator(apiKey)
    translatorCache.set(apiKey, translator)
  }
  return translator
}

/**
 * Confirms the given DeepL API key actually works before doing any file work.
 * Exits the process on failure. Returns the usage fetched while validating,
 * so callers don't need to fetch it again immediately after.
 */
export async function validateDeeplApiKey(apiKey: string): Promise<Usage> {
  try {
    return await getTranslator(apiKey).getUsage()
  }
  catch (error) {
    if (error instanceof AuthorizationError) {
      consola.error('Invalid DeepL API key. Get one at https://www.deepl.com/en/your-account/keys')
    }
    else {
      consola.error('Could not reach DeepL to validate your API key:', error)
    }
    process.exit(1)
  }
}

/**
 * Shows the caller's current DeepL usage, warns if this translation may exceed
 * their remaining quota, and (if enabled) prompts for confirmation before proceeding.
 * @param apiKey - The caller's DeepL API key.
 * @param characterCount - Number of characters this job is about to translate.
 * @param promptConfirm - Whether to prompt the user to confirm before proceeding.
 * @param preFetchedUsage - Usage already fetched moments earlier (e.g. by
 * `validateDeeplApiKey`), to avoid an extra round-trip to DeepL for the same data.
 */
export async function useDeeplUsage(
  apiKey: string,
  characterCount: number,
  promptConfirm: boolean,
  preFetchedUsage?: Usage,
): Promise<void> {
  const usage = preFetchedUsage ?? await getTranslator(apiKey).getUsage()

  if (usage.character) {
    consola.info(
      `DeepL usage: ${usage.character.count.toLocaleString()} / ${usage.character.limit.toLocaleString()} characters used this period.`,
    )
    if (usage.character.count + characterCount > usage.character.limit) {
      consola.warn(
        `This translation (${characterCount.toLocaleString()} characters) may exceed your remaining DeepL quota.`,
      )
    }
  }

  if (promptConfirm) {
    const agreed = await consola.prompt('Do you want to proceed with the translation?', {
      type: 'confirm',
    })
    if (!agreed) {
      consola.info('Translation cancelled.')
      process.exit(0)
    }
  }
}

// Split array into chunks
function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size))
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Serializes every DeepL network call behind a single queue with a fixed gap between
// requests. Target languages translate concurrently (see useTranslateJSON), but they all
// funnel their actual HTTP calls through here, so the real request rate to DeepL stays
// capped at one call per REQUEST_GAP_MS no matter how many languages run at once.
const REQUEST_GAP_MS = 200
let requestQueue: Promise<void> = Promise.resolve()
function scheduleRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = requestQueue.then(fn)
  requestQueue = run.then(() => undefined, () => undefined).then(() => delay(REQUEST_GAP_MS))
  return run
}

// DeepL's API accepts at most 50 texts per translateText() request.
const MAX_TEXTS_PER_REQUEST = 50

// Replace and revert placeholders so DeepL doesn't translate interpolation tokens
function encodePlaceholders(text: string): string {
  return text
    .replace(/\{\{([^}]+)\}\}/g, '<doublebraces>$1</doublebraces>')
    .replace(/\{([^{}]+)\}/g, '<braces>$1</braces>')
    // Only wrap `:name`-style placeholders (colon not preceded by a word char, followed by
    // a letter/underscore) — excludes times/ratios like "10:30" or "3:2" that aren't placeholders.
    .replace(/(?<![\w:]):([A-Z_]\w*)/gi, '<blade>$1</blade>')
}

function decodePlaceholders(text: string): string {
  return text
    .replace(/<doublebraces>([^<]+)<\/doublebraces>/g, '{{$1}}')
    .replace(/<braces>([^<]+)<\/braces>/g, '{$1}')
    .replace(/<blade>([^<]+)<\/blade>/g, ':$1')
}

// Collects every string leaf in a JSON object, depth-first, in the same order
// rebuildWithTranslations() below walks it, so translated values line back up by index.
function flattenLeaves(json: JsonFileObject): string[] {
  const leaves: string[] = []
  for (const key of Object.keys(json)) {
    const value = json[key]
    if (typeof value === 'string')
      leaves.push(value)
    else if (value && typeof value === 'object')
      leaves.push(...flattenLeaves(value))
  }
  return leaves
}

// Rebuilds the same nested shape as `json` (including empty nested objects), substituting
// each string leaf with the next translated value in order.
function rebuildWithTranslations(json: JsonFileObject, translations: string[], cursor: { i: number }): JsonFileObject {
  const result: JsonFileObject = {}
  for (const key of Object.keys(json)) {
    const value = json[key]
    if (typeof value === 'string')
      result[key] = translations[cursor.i++]!
    else if (value && typeof value === 'object')
      result[key] = rebuildWithTranslations(value, translations, cursor)
  }
  return result
}

/**
 * Recursively translates every string value in a JSON object via DeepL, sending up to
 * MAX_TEXTS_PER_REQUEST texts per request instead of one request per string.
 */
export async function translateJSON(
  json: JsonFileObject,
  srcLang: SourceLanguageCode,
  targetLang: TargetLanguageCode,
  formality: 'prefer_less' | 'prefer_more',
  apiKey: string,
): Promise<JsonFileObject> {
  if (typeof json !== 'object' || json === null)
    return json

  const leafTexts = flattenLeaves(json)
  const translatedTexts: string[] = []

  for (const batch of chunkArray(leafTexts, MAX_TEXTS_PER_REQUEST)) {
    const translations = await translateStrings(batch, srcLang, targetLang, formality, apiKey)
    translatedTexts.push(...translations)
  }

  return rebuildWithTranslations(json, translatedTexts, { i: 0 })
}

/**
 * Translates a batch of strings via DeepL in a single request, with retry, timeout & backoff.
 * Auth/quota errors are not retryable and are thrown immediately.
 */
async function translateStrings(
  texts: string[],
  srcLang: SourceLanguageCode,
  targetLang: TargetLanguageCode,
  formality: 'prefer_less' | 'prefer_more',
  apiKey: string,
): Promise<string[]> {
  const encodedTexts = texts.map(encodePlaceholders)
  let attempt = 0
  const maxAttempts = 5
  const baseDelay = 1000 // 1s base delay for retries

  while (attempt < maxAttempts) {
    try {
      const translator = getTranslator(apiKey)

      // The losing side of the race is left pending; catch it independently so an
      // abandoned timeout rejecting later doesn't surface as an unhandled rejection.
      const timeoutPromise = delay(30000).then(() => {
        throw new Error('Timeout: Translation took too long')
      })
      timeoutPromise.catch(() => {})

      const translationResults = await Promise.race([
        scheduleRequest(() => translator.translateText(encodedTexts, srcLang, targetLang, {
          formality,
          tagHandling: 'xml',
          ignoreTags: ['blade', 'braces', 'doublebraces'],
        })),
        timeoutPromise,
      ])
      return translationResults.map(result => decodePlaceholders(result.text))
    }
    catch (error: any) {
      if (error instanceof AuthorizationError || error instanceof QuotaExceededError) {
        throw error
      }

      attempt++

      const retryable
        = error.code === 'ECONNRESET'
          || error.code === 'ECONNABORTED'
          || error instanceof TooManyRequestsError
          || error instanceof ConnectionError
          || (typeof error.message === 'string' && error.message.includes('socket hang up'))

      if (retryable && attempt < maxAttempts) {
        const waitTime = Math.min(baseDelay * 2 ** attempt, 10000) // Exponential backoff (max 10s)
        await delay(waitTime)
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to translate text batch after ${maxAttempts} attempts`)
}

// Translation function with per-language payload support. Target languages translate
// concurrently for wall-clock speed, but every language's DeepL calls funnel through the
// same scheduleRequest() queue (see above), so the actual request rate to DeepL is capped
// regardless of how many target languages are running at once.
export async function useTranslateJSON(
  perLanguagePayloads: Map<string, JsonFileObject>,
  config: Config,
): Promise<string> {
  const dateTime = formattedNewDate()
  try {
    const languagesToTranslate = config.target.filter((targetLanguage) => {
      const jsonToTranslate = perLanguagePayloads.get(targetLanguage) || {}
      if (Object.keys(jsonToTranslate).length === 0) {
        consola.warn(`No keys to translate for ${targetLanguage}, skipping...`)
        return false
      }
      return true
    })

    await Promise.all(languagesToTranslate.map(async (targetLanguage) => {
      const jsonToTranslate = perLanguagePayloads.get(targetLanguage)!

      consola.start(`Translating from ${config.source} to ${targetLanguage}...`)
      const translation = await translateJSON(
        jsonToTranslate,
        config.source,
        targetLanguage,
        config.formality ?? 'prefer_less',
        config.apiKey,
      )
      consola.success(`${targetLanguage} Translation Done`)
      await saveJsonToFile(translation, `jsondeepl/history/${dateTime}/${targetLanguage}.json`)
    }))

    consola.success('All Translations completed successfully.')
    return dateTime
  }
  catch (error) {
    if (error instanceof AuthorizationError) {
      consola.error('Invalid DeepL API key.')
    }
    else if (error instanceof QuotaExceededError) {
      consola.error('Your DeepL account has run out of translation quota.')
    }
    else {
      consola.error('Error during translation:', error)
    }
    consola.error('Translation failed.')
    process.exit(1)
  }
}
// #endregion 🌐 DeepL translation

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

// Merges the new translations with the last state, then removes any keys that no longer
// exist in source — in one read/write pass per target file, instead of a separate cleanup
// pass that would re-read and re-write the same files right afterward.
export async function useMerging(config: Config, dateTime: string): Promise<void> {
  const historyDir = resolve(`jsondeepl/history/${dateTime}`)
  const langDir = resolve(config.langDir)
  consola.info(historyDir)

  const sourceJsonData = await parseJsonFile(langDir, config.source)

  for (const targetLanguage of config.target) {
    consola.start(`Merging ${targetLanguage}.json`)
    const oldState = await parseJsonFile(langDir, targetLanguage)
    const newState = await parseJsonFile(historyDir, targetLanguage)
    const mergedJson = await mergeFiles(oldState, newState)

    const keysToRemove = findKeysToRemove(mergedJson, sourceJsonData)
    removeKeysByPath(mergedJson, keysToRemove)

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
