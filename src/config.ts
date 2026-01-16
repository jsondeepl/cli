import type { Config, ConfigOptions } from './types/common.types.ts'
import * as fs from 'node:fs'
import process from 'node:process'
import { consola } from 'consola'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'pathe'
import { ensureDirectoryExistence, useUser } from './utils.ts'

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

  const apiKey = process.env.JSONDEEPL_API_KEY
  if (!apiKey) {
    consola.error('JSONDEEPL_API_KEY environment variable is not set.')
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
  const user = await useUser(config, 0)
  if (!user || !user.user_id) {
    consola.error('Invalid API key. Please check your jsondeepl/config.json file.')
    process.exit(1)
  }
  if (!user.isActive) {
    consola.error('Your account is inactive. Please contact support to reactivate your account.')
    process.exit(1)
  }
  if (user.credit_balance <= 0) {
    consola.error('You have no credits available. Please add credits to your account.')
    process.exit(1)
  }

  consola.info(`You have $${user.credit_balance} credits available.`)
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
    consola.error('Configuration is missing the JsonDeepL API key.')
  }
  if (!config.options) {
    consola.warn('Configuration is missing the options object. Using default options.')
  }
  if (!config.source || !config.target || !config.langDir || !config.apiKey) {
    return false
  }
  return true
}
