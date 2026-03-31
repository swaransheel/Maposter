import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, Loader } from 'lucide-react'
import { City } from '../types'
import { mapApi } from '../api/mapGenerator'

interface DebouncedCitySearchProps {
  onCitySelect: (city: City) => void
  placeholder?: string
}

export const DebouncedCitySearch: React.FC<DebouncedCitySearchProps> = ({
  onCitySelect,
  placeholder = 'Search cities…',
}) => {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<City[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)

  /* ── debounced search ── */
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([])
      setSelectedIndex(-1)
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)

    try {
      const cities = await mapApi.searchCities(query)
      setSuggestions(cities)
      setSelectedIndex(-1)
    } catch (err) {
      console.error('City search error:', err)
      setSearchError('Failed to search cities. Check backend connection.')
      setSuggestions([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    setIsOpen(true)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => handleSearch(value), 500)
  }

  /* ── keyboard nav ── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((p) => (p < suggestions.length - 1 ? p + 1 : p))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((p) => (p > 0 ? p - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) selectCity(suggestions[selectedIndex])
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }

  const selectCity = (city: City) => {
    onCitySelect(city)
    setInput('')
    setSuggestions([])
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  const close = () => {
    setIsOpen(false)
    setSuggestions([])
    setSelectedIndex(-1)
  }

  /* ── click outside ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ── scroll selected into view ── */
  useEffect(() => {
    if (selectedIndex >= 0 && listboxRef.current) {
      ;(listboxRef.current.children[selectedIndex] as HTMLElement)?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const clearInput = () => {
    setInput('')
    setSuggestions([])
    setSelectedIndex(-1)
  }

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* search input */}
      <div className="relative">
        {isSearching ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader className="w-5 h-5 text-brand-primary animate-spin" />
          </span>
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-tx-tertiary pointer-events-none" />
        )}
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          aria-label="Search for a city"
          aria-autocomplete="list"
          aria-expanded={isOpen && (suggestions.length > 0 || !!searchError)}
          aria-controls="city-listbox"
          className="
            w-full pl-10 pr-10 py-2.5 sm:py-3
            bg-bg-input text-tx-primary placeholder:text-tx-tertiary
            border-2 border-line rounded-xl text-sm sm:text-base
            focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand/20
            transition-all duration-200
          "
        />
        {input && (
          <button
            onClick={clearInput}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-tertiary hover:text-tx-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* error */}
      {isOpen && searchError && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-status-error/10 border border-status-error/30 rounded-xl shadow-card-lg z-10 p-4 text-sm text-status-error">
          {searchError}
        </div>
      )}

      {/* suggestions */}
      {isOpen && !searchError && suggestions.length > 0 && (
        <ul
          id="city-listbox"
          ref={listboxRef}
          role="listbox"
          className="
            absolute top-full left-0 right-0 mt-2
            bg-bg-elevated border border-line rounded-xl shadow-card-lg
            z-10 max-h-60 overflow-y-auto
          "
        >
          {suggestions.map((city, index) => (
            <li
              key={city.id}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => selectCity(city)}
              className={`
                px-4 py-3 cursor-pointer border-b border-line last:border-b-0 transition-colors
                ${
                  index === selectedIndex
                    ? 'bg-brand/10 text-brand-primary'
                    : 'hover:bg-bg-secondary'
                }
              `}
            >
              <div className="font-medium text-tx-primary">{city.name}</div>
              <div className="text-sm text-tx-tertiary">{city.country}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
