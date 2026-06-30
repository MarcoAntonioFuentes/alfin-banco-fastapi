/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Alfin Banco brand palette
        violet: {
          50:  '#f5eef8',
          100: '#ead6f3',
          200: '#d4ade7',
          300: '#b874d4',
          400: '#9c45be',
          500: '#7A1D8A',   // PRIMARY
          600: '#6a187a',
          700: '#551263',
          800: '#430e4f',
          900: '#310a3b',
          950: '#1e0524',
        },
        orange: {
          50:  '#fff3ed',
          100: '#ffe4d0',
          200: '#ffc49d',
          300: '#ff9a61',
          400: '#ff6824',
          500: '#FF4F00',   // ACCENT
          600: '#e54000',
          700: '#c23100',
          800: '#9a2700',
          900: '#7c2000',
        },
        charcoal: '#1a1a2e',
        pearl: '#fafaf9',
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-violet': 'linear-gradient(135deg, #7A1D8A 0%, #430e4f 100%)',
        'gradient-hero': 'linear-gradient(135deg, #1e0524 0%, #7A1D8A 50%, #430e4f 100%)',
        'gradient-orange': 'linear-gradient(135deg, #FF4F00 0%, #ff6824 100%)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease forwards',
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-in-right': 'slideInRight 0.5s ease forwards',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(32px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'violet': '0 8px 32px -8px rgba(122,29,138,0.45)',
        'orange': '0 8px 32px -8px rgba(255,79,0,0.45)',
        'card': '0 4px 24px -4px rgba(26,26,46,0.12)',
        'card-hover': '0 16px 48px -8px rgba(26,26,46,0.2)',
      },
    },
  },
  plugins: [],
}
