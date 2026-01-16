#!/usr/bin/env node
import { consola } from 'consola'
import { useConfigLoader } from './config.ts'
import {
  createLockFile,
  createPerLanguagePayloads,
  parseJsonFile,
  useCleanup,
  useCountPerLanguage,
  useExtract,
  useMerging,
  useTranslateJSON,
  useUser,
  validateJsonFileObject,
} from './utils.ts'

async function main(): Promise<void> {
  consola.start('Using jsondeepl CLI')

  // Load configuration from config.json
  const config = await useConfigLoader()

  // Read the JSON file from the source locale
  const sourceData = await parseJsonFile(config.langDir, config.source)

  // validate sourceData
  await validateJsonFileObject(sourceData)

  // extract changes from lock file (only changed keys)
  const uniqueKeys = await useExtract(config.source, sourceData)
  consola.success('extraction done!')

  // Create per-language payloads (new languages get full source, existing get only changes)
  const perLanguagePayloads = await createPerLanguagePayloads(
    config.langDir,
    config.source,
    sourceData,
    uniqueKeys,
    config.target,
  )

  // Check if there's anything to translate
  let hasWorkToDo = false
  for (const [, data] of perLanguagePayloads) {
    if (Object.keys(data).length > 0) {
      hasWorkToDo = true
      break
    }
  }

  if (!hasWorkToDo) {
    consola.success('All keys are already translated.')
    return
  }

  // count characters per language
  const totalCharacters = await useCountPerLanguage(perLanguagePayloads)
  consola.success(`Total characters to translate: ${totalCharacters}`)

  // check if the user has enough credits
  await useUser(config, totalCharacters)

  // 1. we send the per-language payloads to the API for translation
  const dateTime = await useTranslateJSON(perLanguagePayloads, config)

  // 2. we create a lock file for the source locale
  await createLockFile(config.source, sourceData)

  // 3. we merge the new translations with the last state
  await useMerging(config, dateTime)
  consola.success('Translation completed successfully!')
  // 4. clean up and sorting
  await useCleanup(config.langDir, config)
}

main()
