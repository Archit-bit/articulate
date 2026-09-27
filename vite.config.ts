import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './', // works at any hosting path (Amplify, S3, CloudFront)
  plugins: [react()],
  server: { port: 5173, open: true },
});
