import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Necessário no Windows com OneDrive: eventos nativos do sistema de arquivos
      // são interceptados pelo OneDrive e o Vite não detecta as mudanças.
      // Com polling, o Vite verifica os arquivos a cada 300ms diretamente.
      usePolling: true,
      interval: 300,
    },
  },
})
