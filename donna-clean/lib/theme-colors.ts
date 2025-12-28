/**
 * Donna App Theme Colors - Hybrid Theme
 * Dark header/navigation + Light content
 */

export const DonnaTheme = {
  // Dark areas (header, navigation)
  dark: {
    background: 'linear-gradient(135deg, #1a0e33 0%, #0f0820 100%)',
    backgroundSolid: '#0f0820',
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
      tertiary: 'rgba(255, 255, 255, 0.5)',
    },
    accent: {
      purple: 'rgba(124, 58, 237, 0.2)',
      border: 'rgba(124, 58, 237, 0.4)',
    }
  },

  // Light areas (content, cards)
  light: {
    background: '#f8f9fa',
    backgroundCard: '#ffffff',
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
      tertiary: '#9ca3af',
    },
    border: {
      neutral: '#e5e7eb',
      green: '#22c55e',
      red: '#ef4444',
      purple: '#7c3aed',
    },
    shadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    shadowHover: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },

  // Accent colors (work on both)
  accents: {
    green: '#22c55e',
    red: '#ef4444',
    purple: '#7c3aed',
    yellow: '#f59e0b',
  }
} as const

export type DonnaThemeType = typeof DonnaTheme
