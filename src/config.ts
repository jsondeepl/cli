import type { ConfigOptions } from './types/common.types.ts'
import * as fs from 'node:fs'
import process from 'node:process'
import { consola } from 'consola'
import { resolve } from 'pathe'
import { ensureDirectoryExistence, useUser } from './utils.ts'

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
  apiKey: '',
  engine: 'deepl',
  formality: 'prefer_less',
  options: {
    autoMerge: false,
    prompt: true,
  },
}

export async function useConfigLoader(): Promise<ConfigOptions> {
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

  const configData = fs.readFileSync(configPath, 'utf8')
  const config = JSON.parse(configData)
  const isValid = await validateConfig(config)
  if (!isValid) {
    consola.error(
      'Configuration is invalid. Please review jsondeepl/config.json before running the CLI.',
    )
    process.exit(1)
  }
  const user = await useUser(config.apiKey)
  if (!user) {
    consola.error('Invalid API key. Please check your jsondeepl/config.json file.')
    process.exit(1)
  }
  if (user.users.credit <= 0) {
    consola.error('You have no credits available. Please add credits to your account.')
    process.exit(1)
  }

  consola.info(`You have $${user.users.credit} credits available.`)
  consola.success('Configuration loaded successfully.')
  return config as ConfigOptions
}

async function validateConfig(config: ConfigOptions): Promise<boolean> {
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
  if (!config.engine) {
    consola.error('Configuration is missing the translation engine.')
  }
  if (!config.options) {
    consola.warn('Configuration is missing the options object. Using default options.')
  }
  if (!config.source || !config.target || !config.langDir || !config.apiKey || !config.engine) {
    return false
  }
  return true
}
