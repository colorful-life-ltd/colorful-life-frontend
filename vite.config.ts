import { createHash } from 'node:crypto'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { validateEnvironment } from './src/features/checkout/environment.ts'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  const config = command === 'build' ? validateEnvironment(env) : null
  const revision = env.VITE_SOURCE_REVISION
  if (config && !/^[a-f0-9]{40}$/.test(revision ?? '')) throw Error('Exact VITE_SOURCE_REVISION required')
  return {
    plugins: [react(), {
    name: 'verified-storefront-environment',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (!/\.(?:js|html|json|css|txt|svg|xml)$/.test(output.fileName)) continue
        const text = output.type === 'chunk' ? output.code : typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source)
        if (/\b[sr]k_(?:live|test)_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{8,}|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) throw Error('Private credential detected in build output')
        const wrongKey = config?.target === 'production' ? /\bpk_test_[A-Za-z0-9]{8,}/ : /\bpk_live_[A-Za-z0-9]{8,}/
        if (wrongKey.test(text)) throw Error('Cross-environment publishable key in build output')
      }
      if (!config) return
      this.emitFile({ type: 'asset', fileName: 'storefront-environment.json', source: JSON.stringify({
        version: 1, sourceRevision: revision, target: config.target, paymentMode: config.paymentMode,
        siteOrigin: config.siteOrigin, apiBase: config.apiBase, apiEnvironment: config.target, publishableKeySha256: createHash('sha256').update(config.publishableKey).digest('hex'),
      }, null, 2) + '\n' })
    },
  }],
    server: {
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') } },
  },
  }
})
