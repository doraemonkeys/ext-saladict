import { AddConfig, SyncService } from '../../interface'
import { getNotebook } from '../../helpers'

export interface SyncConfig {
  enable: boolean
  token: string
  syncAll: boolean
}

interface Books {
  id: string
  language: string
  name: string
}

export class Service extends SyncService<SyncConfig> {
  static readonly id = 'eudic'

  static getDefaultConfig(): SyncConfig {
    return {
      enable: false,
      token: '',
      syncAll: false
    }
  }

  async init() {
    const wordbooks = await this.getWordbooks<Books[]>()

    if (wordbooks.length === 0 || !wordbooks) {
      throw new Error('no_wordbook')
    }
  }

  async add(config: AddConfig) {
    await this.addWordOrPatch(config)
  }

  /**
   * sync a word or patch words
   */
  async addWordOrPatch({ words, force }: AddConfig) {
    if (!this.config.enable) {
      return 0
    }

    if (force) {
      words = await getNotebook()
    }

    if (!words || words.length <= 0) {
      return 0
    }

    const payload = force ? words.map(word => word.text) : words[0].text

    await this.requestAddWords(payload)
  }

  /**
   * get the user's wordbooks and judge the correctness of the authorization information
   */
  async getWordbooks<R = void>(): Promise<R> {
    let response: Response
    try {
      response = await fetch(
        `https://api.frdic.com/api/open/v1/studylist/category?language=en`,
        {
          method: 'GET',
          headers: {
            Authorization: this.config.token
          }
        }
      )
    } catch {
      throw new Error('network')
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('illegal_token')
      }
      throw new Error('network')
    }

    let data: any
    try {
      data = await response.json()
    } catch {
      throw new Error('network')
    }

    if (process.env.DEBUG) {
      console.log(`Eudic Connect response(wordbook list)`, data)
    }

    if (!data || !Object.prototype.hasOwnProperty.call(data, 'data')) {
      throw new Error('network')
    }

    return data.data
  }

  async requestAddWords(words: string | string[]) {
    let response: Response
    try {
      response = await fetch(
        `https://api.frdic.com/api/open/v1/studylist/words`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.config.token
          },
          body: JSON.stringify({
            id: '0', // id of default wordbook
            language: 'en',
            words: typeof words === 'string' ? [words] : words
          })
        }
      )
    } catch (e) {
      if (process.env.DEBUG) {
        console.error(e)
      }
      throw new Error('network')
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('illegal_token')
      }
      throw new Error('network')
    }

    return response
  }
}
