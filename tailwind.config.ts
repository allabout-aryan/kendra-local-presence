import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FBFBFA',
        ink: {
          950: '#0E0E12',
          900: '#17171B',
          800: '#22222A',
          700: '#3A3A44',
          500: '#6B6B76',
          400: '#8C8C97',
          300: '#C7C7CF',
          200: '#E2E2E7',
          100: '#EFEFF2',
          50: '#F7F7F8',
        },
        pine: { 700: '#0A4838', 600: '#0E5B46', 500: '#147258', 100: '#DCEFE8', 50: '#EDF7F3' },
        amber: { 700: '#8A5300', 600: '#9A5B00', 100: '#FDF1DC', 50: '#FEF8EC' },
        brick: { 700: '#8F1D14', 600: '#B42318', 100: '#FCE9E7', 50: '#FDF3F2' },
        sky: { 600: '#1E5AA8', 100: '#E5EEF9', 50: '#F1F6FC' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(14,14,18,0.04), 0 1px 1px rgba(14,14,18,0.03)',
        pop: '0 8px 24px -8px rgba(14,14,18,0.18), 0 2px 6px rgba(14,14,18,0.06)',
      },
      borderRadius: { xl2: '0.875rem' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 200ms cubic-bezier(0.2,0.8,0.2,1)',
      },
    },
  },
  plugins: [],
};

export default config;
