import { defineConfig } from 'vite';
import { sendary } from 'sendary';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), sendary()],
});
