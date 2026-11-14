import { defineConfig } from 'vite';
export default defineConfig({ build: { target: 'es2017' }, server: { fs: { allow: ['../..'] } } });
