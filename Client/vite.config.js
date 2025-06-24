import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Simple build optimizations
  build: {
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          socket: ['socket.io-client'],
          ui: ['sweetalert2']
        }
      }
    },
    // Let Vite handle minification automatically
    sourcemap: false,
    target: 'es2020'
  },
  
  // Enable dependency pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'socket.io-client', 'sweetalert2']
  }
})