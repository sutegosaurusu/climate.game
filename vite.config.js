
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pagesで公開する場所
  base: '/climate.game/',

  // 公開するHTMLページを指定
  input: {
    main: resolve(import.meta.dirname, 'index.html'),
    keppen: resolve(import.meta.dirname, 'keppen.html'),
  },
})
