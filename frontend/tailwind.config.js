/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Alias usados por las pantallas existentes, alineados con vino/arena.
        brand: {
          300: '#f4a8b7',
          400: '#ec7591',
          500: '#7F011F',
        },
        ember: { 500: '#d4a84c' },
        // ── Paleta oficial El Establo ─────────────────────
        vino: {
          50:  '#fdf2f4',
          100: '#fce7eb',
          200: '#f9d0d8',
          300: '#f4a8b7',
          400: '#ec7591',
          500: '#df4570',
          600: '#c42554',
          700: '#a31a42',
          800: '#8a1839',
          900: '#7F011F',   // Rojo Vino oficial
          950: '#4d000f',
        },
        arena: {
          50:  '#fefdfb',
          100: '#fdf9f2',
          200: '#F5EBD0',   // Arena Clara oficial
          300: '#edd9a8',
          400: '#e2c47e',
          500: '#d4a84c',
          600: '#b88c35',
          700: '#90692a',
          800: '#6e4f24',
          900: '#503a1c',
        },
        dark: {
          900: '#0d0909',
          800: '#150c0c',
          700: '#1c1010',
          600: '#251515',
          500: '#2e1a1a',
          400: '#3d2222',
          300: '#4f2f2f',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'vino-gradient':   'linear-gradient(135deg, #7F011F 0%, #a31a42 100%)',
        'arena-gradient':  'linear-gradient(135deg, #F5EBD0 0%, #edd9a8 100%)',
        'dark-gradient':   'linear-gradient(180deg, #150c0c 0%, #0d0909 100%)',
        'grill-pattern':   "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%237F011F' fill-opacity='0.04'%3E%3Crect x='0' y='0' width='2' height='40'/%3E%3Crect x='0' y='0' width='40' height='2'/%3E%3C/g%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'glow-vino':    '0 0 20px rgba(127, 1, 31, 0.4)',
        'glow-vino-sm': '0 0 10px rgba(127, 1, 31, 0.25)',
        'glow-sm':      '0 0 10px rgba(127, 1, 31, 0.25)',
        'glow-arena':   '0 0 15px rgba(245, 235, 208, 0.2)',
        'card':         '0 4px 24px rgba(0,0,0,0.5)',
        'card-hover':   '0 8px 32px rgba(0,0,0,0.7)',
        'inner-vino':   'inset 0 0 40px rgba(127, 1, 31, 0.08)',
      },
      animation: {
        'fade-in':     'fadeIn 0.3s ease-out',
        'slide-up':    'slideUp 0.4s ease-out',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
        'shimmer':     'shimmer 1.5s infinite',
        'float':       'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(16px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(127,1,31,0.2)' },
          '50%':      { boxShadow: '0 0 28px rgba(127,1,31,0.55)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}
