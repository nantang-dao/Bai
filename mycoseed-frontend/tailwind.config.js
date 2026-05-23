/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00B3B3',
          foreground: '#ffffff'
        },
        accent: {
          DEFAULT: '#2D8CFF',
          foreground: '#ffffff'
        },
        background: '#F7F7F9',
        foreground: '#1A1A1A',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#1A1A1A'
        },
        'input-bg': '#F5F7FA',
        'text-title': '#1A1A1A',
        'text-body': '#666666',
        'text-placeholder': '#999999',
        border: '#F0F0F0',
        muted: {
          DEFAULT: '#F0F0F0',
          foreground: '#666666'
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff'
        },
        success: {
          DEFAULT: '#10b981',
          foreground: '#ffffff'
        },
        warning: {
          DEFAULT: '#f59e0b',
          foreground: '#ffffff'
        },
        info: {
          DEFAULT: '#3b82f6',
          foreground: '#ffffff'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'PingFang SC', 'sans-serif']
      },
      boxShadow: {
        'soft': '0 4px 20px -4px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 12px 40px -8px rgba(0, 0, 0, 0.12), 0 4px 16px -4px rgba(0, 0, 0, 0.06)',
        'primary': '0 10px 30px -10px rgba(0, 179, 179, 0.3)'
      }
    }
  },
  plugins: []
}
