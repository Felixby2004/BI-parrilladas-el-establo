/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Alias legados usados por las pantallas existentes.
        brand: {
          300: '#e7a7b5',
          400: '#d4778a',
          500: '#9a1733',
        },
        ember: { 500: '#c9a25a' },
        // ── Paleta Brasa & Vino ───────────────────────────
        vino: {
          50:  '#fcf1f3',
          100: '#f7dfe4',
          200: '#edbcc5',
          300: '#de93a1',
          400: '#cb657b',
          500: '#b32642',
          600: '#9a1733',
          700: '#86182d',
          800: '#6e1224',
          900: '#7F011F',   // Rojo Vino oficial
          950: '#3d020f',
        },
        arena: {
          50:  '#fdfaf4',
          100: '#f8f1e4',
          200: '#F5EBD0',   // Arena Clara oficial
          300: '#e5d3ae',
          400: '#d2b98a',
          500: '#c9a25a',
          600: '#ad8443',
          700: '#8a6634',
          800: '#6b4f29',
          900: '#4f3a1f',
        },
        gold: {
          200: '#f0e3c6',
          300: '#e3c894',
          400: '#d6b478',
          500: '#c9a25a',
          600: '#ad8443',
          700: '#8a6634',
        },
        sage: {
          300: '#a9cbb8',
          400: '#8bb9a1',
          500: '#6fa88a',
          600: '#548a6d',
          700: '#3f6c55',
        },
        dark: {
          950: '#080605',
          900: '#0C0A09',
          800: '#12100E',
          700: '#191512',
          600: '#211C18',
          500: '#2A231E',
          400: '#3A302A',
          300: '#4C3F36',
          200: '#6B5A4E',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      opacity: Object.fromEntries(
        Array.from({ length: 101 }, (_, i) => [String(i), String(i / 100)]),
      ),
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'vino-gradient':   'linear-gradient(135deg, #7F011F 0%, #5a0c1b 100%)',
        'gold-gradient':   'linear-gradient(135deg, #e3c894 0%, #c9a25a 100%)',
        'arena-gradient':  'linear-gradient(135deg, #F5EBD0 0%, #e5d3ae 100%)',
        'dark-gradient':   'linear-gradient(180deg, #12100E 0%, #080605 100%)',
        'surface-gradient':'linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0) 55%)',
        'grill-pattern':   "url(\"data:image/svg+xml,%3Csvg width='48' height='48' viewBox='0 0 48 48' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23F5EBD0' fill-opacity='0.025'%3E%3Crect x='0' y='0' width='1' height='48'/%3E%3Crect x='0' y='0' width='48' height='1'/%3E%3C/g%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'glow-vino':    '0 0 32px rgba(127, 1, 31, 0.35)',
        'glow-vino-sm': '0 0 18px rgba(127, 1, 31, 0.22)',
        'glow-sm':      '0 0 18px rgba(127, 1, 31, 0.22)',
        'glow-arena':   '0 0 24px rgba(245, 235, 208, 0.16)',
        'glow-gold':    '0 0 24px rgba(201, 162, 90, 0.22)',
        'card':         'inset 0 1px 0 rgba(255,255,255,0.035), 0 24px 48px -32px rgba(0,0,0,0.95)',
        'card-hover':   'inset 0 1px 0 rgba(255,255,255,0.06), 0 32px 64px -32px rgba(0,0,0,0.95)',
        'inner-vino':   'inset 0 0 48px rgba(127, 1, 31, 0.09)',
        'focus':        '0 0 0 3px rgba(201, 162, 90, 0.28)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-in':     'fadeIn 0.35s ease-out',
        'slide-up':    'slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-glow':  'pulseGlow 2.8s ease-in-out infinite',
        'shimmer':     'shimmer 1.8s infinite',
        'float':       'float 4s ease-in-out infinite',
        'drawer-in':   'drawerIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(18px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 14px rgba(127,1,31,0.18)' },
          '50%':      { boxShadow: '0 0 30px rgba(127,1,31,0.38)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        drawerIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
