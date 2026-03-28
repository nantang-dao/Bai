/** @type {import('tailwindcss').Config} */
export default {
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
        // Background — #F8F8FC: cold-neutral base, aligns with blue-tinted text palette
        background: '#F8F8FC',
        surface: '#FFFFFF',
        'surface-raised': '#F2F2F7',
        border: '#E4E4EA',
        'border-subtle': '#EDEDF3',

        // Typography — cold-neutral axis, no warm drift
        'text-primary': '#0C0C14',
        'text-secondary': '#6B6B7E',
        'text-tertiary': '#9898AF',

        // Accent — full interactive state chain
        accent: {
          DEFAULT: '#0066FF',
          hover: '#0052CC',
          active: '#003DB3',
          muted: '#E5EEFF',
          foreground: '#FFFFFF'
        },

        // Semantic states — DEFAULT + foreground + muted
        success: {
          DEFAULT: '#00875A',
          foreground: '#FFFFFF',
          muted: '#E3F5EE'
        },
        warning: {
          DEFAULT: '#B45309',
          foreground: '#FFFFFF',
          muted: '#FEF3C7'
        },
        destructive: {
          DEFAULT: '#C41C1C',
          foreground: '#FFFFFF',
          muted: '#FEE2E2'
        }
      },

      fontFamily: {
        mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
        sans: ['Geist', 'Inter', 'Noto Sans SC', 'sans-serif']
      },

      boxShadow: {
        // Depth hierarchy: resting → hovered → floating
        card: '0 1px 3px rgba(12, 12, 20, 0.05), 0 1px 2px rgba(12, 12, 20, 0.03)',
        'card-hover': '0 4px 14px rgba(12, 12, 20, 0.09), 0 2px 5px rgba(12, 12, 20, 0.05)',
        float: '0 10px 28px rgba(12, 12, 20, 0.11), 0 4px 10px rgba(12, 12, 20, 0.06)'
      },

      // tech-* prefix avoids silently overriding Tailwind defaults
      borderRadius: {
        'tech-xs': '4px',
        'tech-sm': '6px',
        'tech-md': '8px',
        'tech-lg': '12px',
        'tech-xl': '16px',
        'tech-2xl': '20px'
      },

      // Expose project easing curves as Tailwind transitionTimingFunction values
      transitionTimingFunction: {
        // snap: instant engagement, deliberate release — for button press/release
        snap: 'cubic-bezier(0.2, 0, 0, 1)',
        // glide: gentle entry, organic deceleration — for list reveals, card hover
        glide: 'cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }
  },
  plugins: []
}
