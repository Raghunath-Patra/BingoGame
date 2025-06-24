import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh
      fastRefresh: true,
      // Optimize babel config for production
      babel: {
        compact: true,
        minified: true,
      }
    })
  ],
  
  // Build optimizations
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
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs in production
        drop_debugger: true
      }
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging (disable in production if not needed)
    sourcemap: false
  },
  
  // Development optimizations
  server: {
    // Enable HMR
    hmr: true,
    // Optimize file watching
    watch: {
      usePolling: false,
    }
  },
  
  // Enable dependency pre-bundling optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', 'socket.io-client', 'sweetalert2'],
    // Exclude problematic dependencies if any
    exclude: []
  },
  
  // Enable esbuild for faster builds
  esbuild: {
    target: 'es2020',
    legalComments: 'none'
  }
})