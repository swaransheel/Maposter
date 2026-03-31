import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className="
        relative p-2 rounded-lg
        bg-bg-elevated hover:bg-bg-secondary
        border-2 border-line
        transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2
        dark:focus:ring-offset-bg-primary
        group
      "
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-pressed={isDark}
      type="button"
    >
      <div className="relative w-6 h-6">
        {/* Sun icon */}
        <Sun
          className={`
            absolute inset-0 w-6 h-6
            text-yellow-500
            transition-all duration-300
            ${
              isDark
                ? 'opacity-0 rotate-90 scale-0'
                : 'opacity-100 rotate-0 scale-100'
            }
          `}
          aria-hidden="true"
        />
        
        {/* Moon icon */}
        <Moon
          className={`
            absolute inset-0 w-6 h-6
            text-brand-primary
            transition-all duration-300
            ${
              isDark
                ? 'opacity-100 rotate-0 scale-100'
                : 'opacity-0 -rotate-90 scale-0'
            }
          `}
          aria-hidden="true"
        />
      </div>
      
      {/* Tooltip */}
      <span
        className="
          absolute -bottom-10 left-1/2 -translate-x-1/2
          px-2 py-1 rounded bg-bg-elevated border border-line-strong
          text-xs text-tx-secondary whitespace-nowrap
          opacity-0 group-hover:opacity-100 group-focus:opacity-100
          transition-opacity duration-200
          pointer-events-none
        "
      >
        {isDark ? 'Light' : 'Dark'} mode
      </span>
    </button>
  )
}
