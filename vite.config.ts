import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // esbuild minify (terser보다 빠르고 비슷한 결과)
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // 청크 분리 전략
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-date': ['date-fns'],
          'vendor-ui': ['lucide-react', 'motion'],
        },
      },
    },
    // 청크 크기 경고 임계값
    chunkSizeWarningLimit: 500,
    // 소스맵 비활성화 (프로덕션)
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // 의존성 최적화
  optimizeDeps: {
    include: ['react', 'react-dom', 'date-fns', 'lucide-react', 'motion'],
  },
  // esbuild 옵션 (console/debugger 제거)
  esbuild: {
    drop: ['console', 'debugger'],
  },
})
