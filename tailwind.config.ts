import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "1.5rem",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.08), 0 4px 16px -4px rgba(0, 0, 0, 0.06)',
        'medium': '0 4px 12px -2px rgba(0, 0, 0, 0.1), 0 8px 24px -4px rgba(0, 0, 0, 0.08)',
        'strong': '0 8px 24px -4px rgba(0, 0, 0, 0.12), 0 16px 40px -8px rgba(0, 0, 0, 0.1)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
        'glow-sm': '0 0 10px hsl(var(--primary) / 0.3)',
        'glow': '0 0 20px hsl(var(--primary) / 0.4)',
        'glow-lg': '0 0 30px hsl(var(--primary) / 0.5)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-in-up": {
          from: { transform: "translateY(12px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-down": {
          from: { transform: "translateY(-12px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-left": {
          from: { transform: "translateX(12px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-right": {
          from: { transform: "translateX(-12px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "scale-out": {
          from: { transform: "scale(1)", opacity: "1" },
          to: { transform: "scale(0.95)", opacity: "0" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 15px hsl(var(--primary) / 0.4)" },
          "50%": { boxShadow: "0 0 25px hsl(var(--primary) / 0.6)" },
        },
        "border-spin": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "enter": {
          from: { opacity: "0", transform: "translateY(4px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "exit": {
          from: { opacity: "1", transform: "translateY(0) scale(1)" },
          to: { opacity: "0", transform: "translateY(4px) scale(0.98)" },
        },
        "gradient-flow": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "gradient-y": {
          "0%, 100%": { backgroundPosition: "50% 0%" },
          "50%": { backgroundPosition: "50% 100%" },
        },
        "neon-pulse": {
          "0%, 100%": { 
            textShadow: "0 0 4px currentColor, 0 0 11px currentColor, 0 0 19px currentColor",
            opacity: "1"
          },
          "50%": { 
            textShadow: "0 0 4px currentColor, 0 0 20px currentColor, 0 0 35px currentColor",
            opacity: "0.9"
          },
        },
        "neon-flicker": {
          "0%, 18%, 22%, 25%, 53%, 57%, 100%": {
            textShadow: "0 0 4px currentColor, 0 0 11px currentColor, 0 0 19px currentColor, 0 0 40px currentColor",
            opacity: "1"
          },
          "20%, 24%, 55%": {
            textShadow: "none",
            opacity: "0.4"
          },
        },
        "text-reveal": {
          "0%": { 
            clipPath: "inset(0 100% 0 0)",
            opacity: "0"
          },
          "100%": { 
            clipPath: "inset(0 0 0 0)",
            opacity: "1"
          },
        },
        "text-shimmer": {
          "0%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "spray-in": {
          "0%": { 
            transform: "scale(0.3) rotate(-10deg)",
            opacity: "0",
            filter: "blur(10px)"
          },
          "50%": {
            filter: "blur(2px)"
          },
          "100%": { 
            transform: "scale(1) rotate(0deg)",
            opacity: "1",
            filter: "blur(0)"
          },
        },
        "tag-drop": {
          "0%": { 
            transform: "translateY(-100%) rotate(-5deg)",
            opacity: "0"
          },
          "60%": {
            transform: "translateY(10%) rotate(2deg)"
          },
          "100%": { 
            transform: "translateY(0) rotate(0deg)",
            opacity: "1"
          },
        },
        "urban-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-2px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(2px)" },
        },
        "beat-drop": {
          "0%, 100%": { transform: "scale(1)" },
          "25%": { transform: "scale(1.05)" },
          "50%": { transform: "scale(0.95)" },
          "75%": { transform: "scale(1.02)" },
        },
        "vinyl-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "wave": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(-5px) rotate(-3deg)" },
          "75%": { transform: "translateY(5px) rotate(3deg)" },
        },
        "glitch": {
          "0%, 100%": { 
            clipPath: "inset(0 0 0 0)",
            transform: "translate(0)"
          },
          "20%": { 
            clipPath: "inset(20% 0 60% 0)",
            transform: "translate(-2px, 2px)"
          },
          "40%": { 
            clipPath: "inset(40% 0 30% 0)",
            transform: "translate(2px, -2px)"
          },
          "60%": { 
            clipPath: "inset(60% 0 10% 0)",
            transform: "translate(-1px, 1px)"
          },
          "80%": { 
            clipPath: "inset(10% 0 80% 0)",
            transform: "translate(1px, -1px)"
          },
        },
        "border-glow": {
          "0%, 100%": { 
            borderColor: "hsl(var(--primary) / 0.5)",
            boxShadow: "0 0 5px hsl(var(--primary) / 0.3)"
          },
          "50%": { 
            borderColor: "hsl(var(--accent) / 0.8)",
            boxShadow: "0 0 20px hsl(var(--accent) / 0.5)"
          },
        },
        "ripple": {
          "0%": { 
            transform: "scale(0)",
            opacity: "0.5"
          },
          "100%": { 
            transform: "scale(4)",
            opacity: "0"
          },
        },
        "morph": {
          "0%, 100%": { borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" },
          "50%": { borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%" },
        },
        "tilt": {
          "0%, 100%": { transform: "perspective(1000px) rotateY(0deg)" },
          "50%": { transform: "perspective(1000px) rotateY(5deg)" },
        },
        "slide-reveal": {
          "0%": { 
            transform: "translateX(-100%)",
            opacity: "0"
          },
          "100%": { 
            transform: "translateX(0)",
            opacity: "1"
          },
        },
        "counter": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "slide-in-up": "slide-in-up 0.25s ease-out",
        "slide-in-down": "slide-in-down 0.25s ease-out",
        "slide-in-left": "slide-in-left 0.25s ease-out",
        "slide-in-right": "slide-in-right 0.25s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "scale-out": "scale-out 0.15s ease-in",
        "spin-slow": "spin-slow 3s linear infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "bounce-soft": "bounce-soft 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "border-spin": "border-spin 3s linear infinite",
        "enter": "enter 0.2s ease-out",
        "exit": "exit 0.15s ease-in",
        "gradient-flow": "gradient-flow 4s ease infinite",
        "gradient-x": "gradient-x 3s ease infinite",
        "gradient-y": "gradient-y 3s ease infinite",
        "neon-pulse": "neon-pulse 2s ease-in-out infinite",
        "neon-flicker": "neon-flicker 3s linear infinite",
        "text-reveal": "text-reveal 0.8s cubic-bezier(0.77, 0, 0.175, 1) forwards",
        "text-shimmer": "text-shimmer 3s linear infinite",
        "spray-in": "spray-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "tag-drop": "tag-drop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "urban-shake": "urban-shake 0.5s ease-in-out",
        "beat-drop": "beat-drop 0.6s ease-in-out",
        "vinyl-spin": "vinyl-spin 4s linear infinite",
        "wave": "wave 2s ease-in-out infinite",
        "glitch": "glitch 1s linear infinite",
        "border-glow": "border-glow 2s ease-in-out infinite",
        "ripple": "ripple 0.6s linear",
        "morph": "morph 8s ease-in-out infinite",
        "tilt": "tilt 3s ease-in-out infinite",
        "slide-reveal": "slide-reveal 0.5s cubic-bezier(0.77, 0, 0.175, 1) forwards",
        "counter": "counter 0.4s ease-out forwards",
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
