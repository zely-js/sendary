import { defineConfig } from 'vite';
import { staga } from 'staga';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), staga()],
});
