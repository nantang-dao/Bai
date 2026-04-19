/**
 * Nuxt 3.18+：默认 `paths.mjs` 模板不设 `write: true`，仅存于 VFS。
 * SSR 产物 `.nuxt/dist/server/server.mjs` 在磁盘上仍外部引用 `#internal/nuxt/paths`，
 * Node 运行时需要项目 package.json 的 imports + 磁盘上的 `.nuxt/paths.mjs`。
 * @see https://github.com/nuxt/nuxt/issues/26731
 */
import { defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'persist-nuxt-paths' },
  setup(_options, nuxt) {
    nuxt.hook('app:templates', (app) => {
      for (const tmpl of app.templates) {
        if (tmpl.filename === 'paths.mjs') {
          tmpl.write = true
        }
      }
    })
  },
})
