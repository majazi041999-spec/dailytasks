
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}", // این خط فایل‌های روت مثل App.tsx و index.tsx را می‌گیرد
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'sans-serif'],
      },
      colors: {
        glass: 'rgba(255, 255, 255, 0.7)',
        glassBorder: 'rgba(255, 255, 255, 0.5)',
        primary: '#3B82F6',
        secondary: '#6366f1',
        accent: '#f43f5e',
        darkBg: '#0f172a',
        darkGlass: 'rgba(17, 24, 39, 0.7)',
      },
      animation: {
          'blob': 'blob 20s infinite alternate',
          'fade-scale': 'fadeScale 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          'bounce-subtle': 'bounceSubtle 2s infinite',
          'slide-up-fade': 'slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1)', // Very smooth iOS-like slide
          'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          'pop': 'pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy pop effect
          'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
          blob: {
              '0%': { transform: 'translate(0, 0) scale(1)' },
              '33%': { transform: 'translate(30vw, -10vh) scale(1.5)' },
              '66%': { transform: 'translate(-20vw, 20vh) scale(0.8)' },
              '100%': { transform: 'translate(10vw, 10vh) scale(1.2)' },
          },
          fadeScale: {
              '0%': { opacity: '0', transform: 'scale(0.98) translateY(10px)' },
              '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          },
          bounceSubtle: {
              '0%, 100%': { transform: 'translateY(-3%)', animationTimingFunction: 'cubic-bezier(0.8,0,1,1)' },
              '50%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0,0,0.2,1)' },
          },
          slideUpFade: {
              '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
              '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          },
          slideInRight: {
              '0%': { opacity: '0', transform: 'translateX(20px)' },
              '100%': { opacity: '1', transform: 'translateX(0)' },
          },
          pop: {
              '0%': { opacity: '0', transform: 'scale(0.9)' },
              '100%': { opacity: '1', transform: 'scale(1)' },
          }
      }
    }
  },
  plugins: [],
}
