import type { Config, ConfigOptions } from './types/common.types.ts'
import * as fs from 'node:fs'
import process from 'node:process'
import { consola } from 'consola'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'pathe'
import { ensureDirectoryExistence, validateDeeplApiKey } from './utils.ts'

// Load environment variables from .env file
dotenvConfig()

export const defaultConfig: ConfigOptions = {
  source: 'en',
  target: [
    'ar',
    'bg',
    'cs',
    'da',
    'de',
    'el',
    'en-GB',
    'en-US',
    'es',
    'et',
    'fi',
    'fr',
    'hu',
    'id',
    'it',
    'ja',
    'ko',
    'lt',
    'lv',
    'nb',
    'nl',
    'pl',
    'pt-BR',
    'pt-PT',
    'ro',
    'ru',
    'sk',
    'sl',
    'sv',
    'tr',
    'uk',
    'zh',
  ],
  langDir: './i18n/locales',
  formality: 'prefer_less',
  options: {
    prompt: true,
  },
}

// Load and validate configuration
export async function useConfigLoader(): Promise<Config> {
  consola.info('Loading configuration...')
  const configPath = resolve('jsondeepl/config.json')
  const historyDirPath = resolve('jsondeepl/history')
  if (!fs.existsSync(configPath)) {
    consola.warn('Configuration file not found: jsondeepl/config.json')
    await consola.prompt('Would you like to create a default configuration file?', {
      type: 'confirm',
    })
    consola.info('creating default configuration...')
    await ensureDirectoryExistence(configPath)

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8')
    consola.success(
      'Default configuration file created successfully. Please review jsondeepl/config.json before running the CLI.',
    )
    process.exit(0)
  }
  if (!fs.existsSync(historyDirPath)) {
    await ensureDirectoryExistence(historyDirPath)
  }

  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) {
    consola.error('DEEPL_API_KEY environment variable is not set. Get a free key at https://www.deepl.com/en/your-account/keys')
    process.exit(1)
  }
  const configData = fs.readFileSync(configPath, 'utf8')
  const config: Config = { ...JSON.parse(configData), apiKey }
  const isValid = await validateConfig(config)
  if (!isValid) {
    consola.error(
      'Configuration is invalid. Please review jsondeepl/config.json before running the CLI.',
    )
    process.exit(1)
  }
  config.options ??= defaultConfig.options

  // Confirm the key actually works before doing any file work; reuse the usage this
  // fetches so callers don't need a second DeepL round-trip for the same data.
  config.usage = await validateDeeplApiKey(config.apiKey)

  consola.success('Configuration loaded successfully.')
  return config as Config
}

async function validateConfig(config: Config): Promise<boolean> {
  if (!config.source) {
    consola.error('Configuration is missing the source language.')
  }
  if (!config.target || config.target.length === 0) {
    consola.error('Configuration is missing the target languages.')
  }
  if (!config.langDir) {
    consola.error('Configuration is missing the language directory.')
  }
  if (!config.apiKey) {
    consola.error('Configuration is missing the DeepL API key.')
  }
  if (!config.options) {
    consola.warn('Configuration is missing the options object. Using default options.')
  }
  if (!config.source || !config.target || !config.langDir || !config.apiKey) {
    return false
  }
  return true
}
