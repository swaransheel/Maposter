import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Theme } from '../types'

interface ThemeDropdownProps {
  themes: Theme[]
  selectedTheme: Theme | null
  onThemeSelect: (theme: Theme) => void
}

export const ThemeDropdown: React.FC<ThemeDropdownProps> = ({
  themes,
  selectedTheme,
  onThemeSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<(HTMLDivElement | null)[]>([])

  /* ── keyboard nav ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      setIsOpen(true)
      return
    }
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((p) => (p < themes.length - 1 ? p + 1 : p))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((p) => (p > 0 ? p - 1 : -1))
        break
      case 'Home':
        e.preventDefault()
        setSelectedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setSelectedIndex(themes.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (selectedIndex >= 0) {
          onThemeSelect(themes[selectedIndex])
          setIsOpen(false)
          setSelectedIndex(-1)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSelectedIndex(-1)
        break
      case 'Tab':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  /* ── focus ── */
  useEffect(() => {
    if (isOpen && selectedIndex >= 0) optionsRef.current[selectedIndex]?.focus()
  }, [isOpen, selectedIndex])

  /* ── click outside ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* trigger */}
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) setSelectedIndex(0) }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="theme-listbox"
        className="
          w-full px-4 py-3
          bg-bg-input text-tx-primary placeholder:text-tx-tertiary
          border-2 border-line rounded-xl font-medium
          hover:border-brand-primary
          focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand/20
          transition-all duration-200
          flex items-center justify-between
        "
      >
        <span className={selectedTheme ? 'text-tx-primary' : 'text-tx-tertiary'}>
          {selectedTheme ? selectedTheme.name : 'Select a theme…'}
        </span>
        <ChevronDown className={`w-5 h-5 text-tx-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* dropdown */}
      {isOpen && (
        <div
          id="theme-listbox"
          role="listbox"
          className="
            absolute top-full left-0 right-0 mt-2
            bg-bg-elevated border border-line rounded-xl shadow-card-lg
            z-50 p-2 sm:p-3 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto
          "
        >
          {themes.length === 0 ? (
            <div className="col-span-1 xs:col-span-2 sm:col-span-2 p-4 text-center text-tx-tertiary">
              No themes available. Ensure backend is running.
            </div>
          ) : (
            themes.map((theme, index) => (
              <div
                key={theme.id}
                ref={(el) => { optionsRef.current[index] = el }}
                role="option"
                aria-selected={selectedTheme?.id === theme.id}
                tabIndex={selectedIndex === index ? 0 : -1}
                onKeyDown={handleKeyDown}
                onClick={() => { onThemeSelect(theme); setIsOpen(false); setSelectedIndex(-1) }}
                className={`
                  p-2.5 sm:p-3 rounded-xl cursor-pointer border-2 transition-all flex flex-col gap-1.5 sm:gap-2
                  ${
                    selectedTheme?.id === theme.id
                      ? 'border-brand-primary bg-brand/10'
                      : 'border-line hover:border-brand-primary/50 hover:bg-bg-secondary'
                  }
                `}
              >
                <span className="font-medium text-tx-primary text-sm">{theme.name}</span>
                <span className="text-xs text-tx-tertiary">{theme.description}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
