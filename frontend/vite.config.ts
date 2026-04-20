import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

export default defineConfig({
plugins: [react()],
define: {
  'import.meta.env.VITE_HF_API_KEY': JSON.stringify(process.env.HF_API_TOKEN || process.env.HF_API_KEY),
},
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    }
  }
}
})
