#!/usr/bin/env node
import { consola } from 'consola'
import { useConfigLoader } from './config.ts'
import {
  createLockFile,
  parseJsonFile,
  useCleanup,
  useCount,
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

  // extract changes
  const uniqueKeys = await useExtract(config.source, sourceData)
  consola.success('extraction done!')
  if (Object.keys(uniqueKeys).length === 0) {
    consola.success('All keys are already translated.')
    return
  }

  // count characters
  const characterCount = await useCount(uniqueKeys)
  consola.success(`Total characters to translate: ${characterCount} x ${config.target.length} languages`)

  // check if the user has enough credits
  await useUser(config, characterCount * config.target.length)

  // 1. we send all the unique keys to the API for translation
  const dateTime = await useTranslateJSON(uniqueKeys, config)

  // 2. we create a lock file for the source locale
  await createLockFile(config.source, sourceData)

  // 3. we merge the new translations with the last state
  await useMerging(config, dateTime)
  consola.success('Translation completed successfully!')
  // 4. clean up and sorting
  await useCleanup(config.langDir, config)
}

main()
