/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--color-surface)',
          alt: 'var(--color-surface-alt)',
        },
        accent: {
          primary: 'var(--color-accent-primary)',
          cyan: 'var(--color-accent-cyan)',
        },
      },
    },
  },
  plugins: [],
};