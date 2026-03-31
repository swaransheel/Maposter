import { useState, useEffect, useRef } from 'react'
import { mapApi } from '../api/mapGenerator'
import type { City, Theme, GeneratedPoster } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const normalizeProfileField = (value: string) => value.trim()

interface EditorState {
  location: string
  title: string
  subtitle: string
  coordinates: string
  selectedTheme: string
  orientation: 'portrait' | 'landscape'
  size: string
  isGenerating: boolean
  error: string
  success: string
  distance: number
}

type ViewTab = 'editor' | 'gallery' | 'journal' | 'account'

export default function Editor() {
  const { user, session, signOut } = useAuth()

  const [state, setState] = useState<EditorState>({
    location: '',
    title: '',
    subtitle: '',
    coordinates: '',
    selectedTheme: '',
    orientation: 'portrait',
    size: '24x36',
    isGenerating: false,
    error: '',
    success: '',
    distance: 15000,
  })

  const [themes, setThemes] = useState<Theme[]>([])
  const [searchResults, setSearchResults] = useState<City[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [posters, setPosters] = useState<GeneratedPoster[]>([])
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ViewTab>('editor')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [showFullscreenModal, setShowFullscreenModal] = useState(false)
  const [selectedGalleryPoster, setSelectedGalleryPoster] = useState<GeneratedPoster | null>(null)
  const [showGalleryModal, setShowGalleryModal] = useState(false)
  const [galleryZoomLevel, setGalleryZoomLevel] = useState(1)
  const [selectedPosters, setSelectedPosters] = useState<Set<string>>(new Set())
  
  // Journal Features
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [collections, setCollections] = useState<Record<string, string[]>>({})
  const [collectionIdsByName, setCollectionIdsByName] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, {note: string, mood?: string, date: string}>>({})
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [noteModalPoster, setNoteModalPoster] = useState<GeneratedPoster | null>(null)
  const [tempNoteText, setTempNoteText] = useState('')
  const [tempNoteMood, setTempNoteMood] = useState<string | null>(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [currentCollectionView, setCurrentCollectionView] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [savedProfileName, setSavedProfileName] = useState('')
  const [savedAvatarUrl, setSavedAvatarUrl] = useState('')
  const [isProfileEditing, setIsProfileEditing] = useState(false)
  const [isProfileSaving, setIsProfileSaving] = useState(false)
  const [isAccountActionLoading, setIsAccountActionLoading] = useState(false)
  const [accountMessage, setAccountMessage] = useState('')
  
  const cardRef = useRef<HTMLDivElement>(null)

  const loadJournalFromSupabase = async () => {
    if (!user) return

    const [favoritesRes, collectionsRes, collectionItemsRes, notesRes] = await Promise.all([
      supabase.from('favorites').select('poster_id'),
      supabase.from('collections').select('id,name'),
      supabase.from('collection_items').select('collection_id,poster_id'),
      supabase.from('notes').select('poster_id,note,mood,updated_at'),
    ])

    if (!favoritesRes.error && favoritesRes.data) {
      setFavorites(new Set(favoritesRes.data.map((row) => row.poster_id as string)))
    }

    const nameToId: Record<string, string> = {}
    const idToName: Record<string, string> = {}
    if (!collectionsRes.error && collectionsRes.data) {
      collectionsRes.data.forEach((row) => {
        nameToId[row.name as string] = row.id as string
        idToName[row.id as string] = row.name as string
      })
      setCollectionIdsByName(nameToId)
    }

    const mappedCollections: Record<string, string[]> = {}
    Object.keys(nameToId).forEach((name) => {
      mappedCollections[name] = []
    })
    if (!collectionItemsRes.error && collectionItemsRes.data) {
      collectionItemsRes.data.forEach((row) => {
        const name = idToName[row.collection_id as string]
        if (!name) return
        if (!mappedCollections[name]) mappedCollections[name] = []
        if (!mappedCollections[name].includes(row.poster_id as string)) {
          mappedCollections[name].push(row.poster_id as string)
        }
      })
    }
    setCollections(mappedCollections)

    const mappedNotes: Record<string, { note: string; mood?: string; date: string }> = {}
    if (!notesRes.error && notesRes.data) {
      notesRes.data.forEach((row) => {
        const updatedAt = row.updated_at ? new Date(row.updated_at as string) : new Date()
        mappedNotes[row.poster_id as string] = {
          note: row.note as string,
          mood: (row.mood as string | null) || undefined,
          date: updatedAt.toLocaleDateString(),
        }
      })
    }
    setNotes(mappedNotes)
  }

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      try {
        const loadedThemes = await mapApi.getThemes()
        setThemes(loadedThemes)
        if (loadedThemes.length > 0) {
          setState((prev) => ({ ...prev, selectedTheme: loadedThemes[0].id }))
        }

        const loadedPosters = await mapApi.getPosters()
        setPosters(loadedPosters)

        await loadJournalFromSupabase()
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }
    loadData()
  }, [user])

  useEffect(() => {
    if (!user) return

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name,avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      if (!error && data) {
        const loadedName = (data.full_name as string) || ''
        const loadedAvatar = (data.avatar_url as string) || ''
        setProfileName(loadedName)
        setAvatarUrl(loadedAvatar)
        setSavedProfileName(loadedName)
        setSavedAvatarUrl(loadedAvatar)
      } else {
        const loadedName = (user.user_metadata?.full_name as string) || ''
        const loadedAvatar = (user.user_metadata?.avatar_url as string) || ''
        setProfileName(loadedName)
        setAvatarUrl(loadedAvatar)
        setSavedProfileName(loadedName)
        setSavedAvatarUrl(loadedAvatar)
      }
    }

    loadProfile()
  }, [user])

  const handleLocationSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setState((prev) => ({ ...prev, location: query }))

    if (query.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    try {
      const results = await mapApi.searchCities(query)
      setSearchResults(results)
      setShowSearchResults(true)
    } catch (err) {
      console.error('Search failed:', err)
    }
  }

  const handleSelectCity = (city: City) => {
    setSelectedCity(city)
    const cityName = city.name.toUpperCase()
    const countryName = city.country.toUpperCase()
    const coords = `${Math.abs(city.latitude || 0).toFixed(4)}° ${city.latitude! > 0 ? 'N' : 'S'}, ${Math.abs(city.longitude || 0).toFixed(4)}° ${city.longitude! > 0 ? 'E' : 'W'}`
    
    setState((prev) => ({
      ...prev,
      location: `${city.name}, ${city.country}`,
      title: cityName,
      subtitle: countryName,
      coordinates: coords,
    }))
    setShowSearchResults(false)
  }

  const handleZoom = () => {
    setZoomLevel((prev) => (prev >= 2 ? 1 : prev + 0.5))
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    // Scroll up = zoom in, scroll down = zoom out
    if (e.deltaY < 0) {
      // Scroll up - zoom in
      setZoomLevel((prev) => Math.min(prev + 0.1, 3))
    } else {
      // Scroll down - zoom out
      setZoomLevel((prev) => Math.max(prev - 0.1, 1))
    }
  }

  const handleGalleryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    // Scroll up = zoom in, scroll down = zoom out
    if (e.deltaY < 0) {
      // Scroll up - zoom in
      setGalleryZoomLevel((prev) => Math.min(prev + 0.1, 3))
    } else {
      // Scroll down - zoom out
      setGalleryZoomLevel((prev) => Math.max(prev - 0.1, 1))
    }
  }

  const handleGalleryShare = async () => {
    if (!selectedGalleryPoster) return
    
    try {
      // Create a canvas to composite the map with text information
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = () => {
        // Scale the downloaded image to print-quality (1500px wide, 2:3 aspect)
        const targetWidth = 1500
        const targetHeight = 2000  // 2:3 aspect ratio
        const padding = 80  // Padding around content (like card p-12 but scaled)
        
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        
        // Draw white background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Calculate image dimensions with padding (like the card layout)
        const contentWidth = targetWidth - (padding * 2)
        const textAreaHeight = 280  // Space for title, country, coordinate
        const imageHeight = targetHeight - (padding * 2) - textAreaHeight
        
        // Draw the map image scaled and positioned
        ctx.drawImage(
          img,
          padding,
          padding,
          contentWidth,
          imageHeight
        )
        
        // Calculate text positioning
        const textStartY = padding + imageHeight + 60
        
        // Draw title
        ctx.fillStyle = '#1e293b'  // slate-900
        ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(selectedGalleryPoster.city, targetWidth / 2, textStartY)
        
        // Draw separator lines and country
        const countryY = textStartY + 90
        ctx.strokeStyle = '#e2e8f0'  // slate-200
        ctx.lineWidth = 2
        const lineX1 = targetWidth / 2 - 80
        const lineX2 = targetWidth / 2 + 80
        ctx.beginPath()
        ctx.moveTo(lineX1, countryY)
        ctx.lineTo(lineX2, countryY)
        ctx.stroke()
        
        ctx.fillStyle = '#64748b'  // slate-500
        ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillText(selectedGalleryPoster.country || '', targetWidth / 2, countryY + 20)
        
        // Draw coordinates
        const coordinatesText = selectedGalleryPoster.latitude && selectedGalleryPoster.longitude 
          ? `${(typeof selectedGalleryPoster.latitude === 'number' ? selectedGalleryPoster.latitude : parseFloat(selectedGalleryPoster.latitude as string)).toFixed(4)}°, ${(typeof selectedGalleryPoster.longitude === 'number' ? selectedGalleryPoster.longitude : parseFloat(selectedGalleryPoster.longitude as string)).toFixed(4)}°`
          : 'No coordinates'
        ctx.font = '20px monospace'
        ctx.fillStyle = '#94a3b8'  // slate-400
        ctx.fillText(coordinatesText, targetWidth / 2, countryY + 70)
        
        // Download the composite image
        canvas.toBlob((blob) => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${selectedGalleryPoster.city}_${selectedGalleryPoster.theme}_${new Date().getTime()}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          
          setState((prev) => ({
            ...prev,
            success: 'Poster downloaded successfully!'
          }))
          setTimeout(() => {
            setState((prev) => ({ ...prev, success: '' }))
          }, 3000)
        })
      }
      
      img.src = selectedGalleryPoster.url
    } catch (err) {
      console.error('Gallery share failed:', err)
      setState((prev) => ({
        ...prev,
        error: 'Failed to download the poster'
      }))
    }
  }

  const cleanupJournalData = (deletedPosterIds: Set<string>) => {
    setFavorites(prev => {
      const next = new Set(prev)
      deletedPosterIds.forEach(id => next.delete(id))
      return next
    })

    setCollections(prev => {
      const next: Record<string, string[]> = {}
      Object.entries(prev).forEach(([name, ids]) => {
        next[name] = ids.filter(id => !deletedPosterIds.has(id))
      })
      return next
    })

    setNotes(prev => {
      const next = { ...prev }
      deletedPosterIds.forEach(id => {
        delete next[id]
      })
      return next
    })
  }

  const getThemeDisplayName = (themeId: string) => {
    const matchedTheme = themes.find((theme) => theme.id === themeId)
    if (matchedTheme?.name) return matchedTheme.name

    return themeId
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const saveProfile = async () => {
    if (!user) return

    const normalizedName = normalizeProfileField(profileName)
    const normalizedAvatar = normalizeProfileField(avatarUrl)

    // Always reflect latest values and exit edit mode on Save click.
    setProfileName(normalizedName)
    setAvatarUrl(normalizedAvatar)
    setIsProfileEditing(false)
    setAccountMessage('')

    if (
      normalizedName === normalizeProfileField(savedProfileName)
      && normalizedAvatar === normalizeProfileField(savedAvatarUrl)
    ) {
      return
    }

    setIsProfileSaving(true)
    setAccountMessage('')

    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        full_name: normalizedName || null,
        avatar_url: normalizedAvatar || null,
      },
      { onConflict: 'id' },
    )

    setIsProfileSaving(false)
    if (error) {
      setAccountMessage('Profile updated locally but failed to save remotely')
      return
    }
    setSavedProfileName(normalizedName)
    setSavedAvatarUrl(normalizedAvatar)
    setAccountMessage('Profile saved successfully')
  }

  const cancelProfileEdit = () => {
    setProfileName(savedProfileName)
    setAvatarUrl(savedAvatarUrl)
    setIsProfileEditing(false)
    setAccountMessage('')
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAccountMessage('Please select an image file')
      e.target.value = ''
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setAccountMessage('Avatar image must be 2MB or smaller')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setAvatarUrl(typeof reader.result === 'string' ? reader.result : '')
      setAccountMessage('')
    }
    reader.onerror = () => {
      setAccountMessage('Failed to read image from device')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const refreshSession = async () => {
    setAccountMessage('')
    const { error } = await supabase.auth.refreshSession()
    setAccountMessage(error ? 'Failed to refresh session' : 'Session refreshed')
  }

  const exportMyData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id,
        email: user?.email || null,
        isAnonymous: Boolean(user?.is_anonymous),
      },
      stats: {
        posterCount: posters.length,
        favoritesCount: favorites.size,
        notesCount: Object.keys(notes).length,
        collectionsCount: Object.keys(collections).length,
      },
      posters,
      favorites: Array.from(favorites),
      collections,
      notes,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `maposter_export_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const clearJournalData = async () => {
    if (!confirm('Clear all favorites, collections and notes?')) return
    setIsAccountActionLoading(true)
    setAccountMessage('')

    const [notesRes, favoritesRes, itemsRes, collectionsRes] = await Promise.all([
      supabase.from('notes').delete().neq('poster_id', ''),
      supabase.from('favorites').delete().neq('poster_id', ''),
      supabase.from('collection_items').delete().neq('poster_id', ''),
      supabase.from('collections').delete().neq('id', ''),
    ])

    setIsAccountActionLoading(false)
    if (notesRes.error || favoritesRes.error || itemsRes.error || collectionsRes.error) {
      setAccountMessage('Some journal data could not be cleared')
      return
    }

    setFavorites(new Set())
    setCollections({})
    setCollectionIdsByName({})
    setNotes({})
    setAccountMessage('Journal data cleared')
  }

  const deleteAllMyPosters = async () => {
    if (!confirm('Delete all your posters? This cannot be undone.')) return
    setIsAccountActionLoading(true)
    setAccountMessage('')

    try {
      const filenames = posters.map((p) => p.filename).filter((name): name is string => Boolean(name))
      if (filenames.length === 0) {
        setIsAccountActionLoading(false)
        setAccountMessage('No posters to delete')
        return
      }

      const result = await mapApi.bulkDeletePosters(filenames)
      const deletedFiles = new Set(result.deleted)
      const deletedIds = new Set(
        posters.filter((p) => p.filename && deletedFiles.has(p.filename)).map((p) => p.id),
      )

      setPosters((prev) => prev.filter((p) => !deletedIds.has(p.id)))
      cleanupJournalData(deletedIds)
      setAccountMessage(
        result.errors.length > 0
          ? `Deleted posters with some errors: ${result.errors.join(', ')}`
          : 'All posters deleted successfully',
      )
    } catch (err) {
      setAccountMessage(err instanceof Error ? err.message : 'Failed to delete posters')
    } finally {
      setIsAccountActionLoading(false)
    }
  }

  const deleteAllMyData = async () => {
    if (!confirm('Delete all your data (posters, favorites, collections, notes)?')) return
    await deleteAllMyPosters()
    await clearJournalData()
  }

  const handleShare = async () => {
    if (!generatedImageUrl || !selectedCity) return
    
    try {
      // Create a canvas to composite the map with text information
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = () => {
        // Scale the downloaded image to print-quality (1500px wide, 2:3 aspect)
        const targetWidth = 1500
        const targetHeight = 2000  // 2:3 aspect ratio
        const padding = 80  // Padding around content (like card p-12 but scaled)
        
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        
        // Draw white background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Calculate image dimensions with padding (like the card layout)
        const contentWidth = targetWidth - (padding * 2)
        const textAreaHeight = 280  // Space for title, country, coordinate
        const imageHeight = targetHeight - (padding * 2) - textAreaHeight
        
        // Draw the map image scaled and positioned
        ctx.drawImage(
          img,
          padding,
          padding,
          contentWidth,
          imageHeight
        )
        
        // Calculate text positioning
        const textStartY = padding + imageHeight + 60
        
        // Draw title
        ctx.fillStyle = '#1e293b'  // slate-900
        ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(state.title, targetWidth / 2, textStartY)
        
        // Draw separator lines and country
        const countryY = textStartY + 90
        ctx.strokeStyle = '#e2e8f0'  // slate-200
        ctx.lineWidth = 2
        const lineX1 = targetWidth / 2 - 80
        const lineX2 = targetWidth / 2 + 80
        ctx.beginPath()
        ctx.moveTo(lineX1, countryY)
        ctx.lineTo(lineX2, countryY)
        ctx.stroke()
        
        ctx.fillStyle = '#64748b'  // slate-500
        ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.fillText(state.subtitle, targetWidth / 2, countryY + 20)
        
        // Draw coordinates
        ctx.font = '20px monospace'
        ctx.fillStyle = '#94a3b8'  // slate-400
        ctx.fillText(state.coordinates, targetWidth / 2, countryY + 70)
        
        // Download the composite image
        canvas.toBlob((blob) => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${selectedCity.name}_${state.selectedTheme}_${new Date().getTime()}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          
          setState((prev) => ({
            ...prev,
            success: 'Poster downloaded successfully!'
          }))
          setTimeout(() => {
            setState((prev) => ({ ...prev, success: '' }))
          }, 3000)
        })
      }
      
      img.src = generatedImageUrl
    } catch (err) {
      console.error('Share failed:', err)
      setState((prev) => ({
        ...prev,
        error: 'Failed to share the poster'
      }))
    }
  }

  const handleGenerate = async () => {
    if (!selectedCity || !state.selectedTheme) {
      setState((prev) => ({
        ...prev,
        error: 'Please select a location and theme',
      }))
      return
    }

    setState((prev) => ({
      ...prev,
      isGenerating: true,
      error: '',
      success: '',
    }))

    try {
      // Parse size dimensions
      const [widthStr, heightStr] = state.size.split('x')
      let width = parseFloat(widthStr)
      let height = parseFloat(heightStr)
      
      // Convert cm to inches if needed (50x70 cm option)
      if (state.size.includes('50x70')) {
        width = 50 / 2.54  // Convert cm to inches
        height = 70 / 2.54
      }
      
      const poster = await mapApi.generateMap({
        city: selectedCity.name,
        country: selectedCity.country,
        theme: state.selectedTheme,
        latitude: selectedCity.latitude || 0,
        longitude: selectedCity.longitude || 0,
        distance: state.distance,
        width: width,
        height: height,
        dpi: 150,
      })

      setGeneratedImageUrl(poster.url)
      setPosters((prev) => [poster, ...prev])
      
      setState((prev) => ({
        ...prev,
        success: `"${selectedCity.name}" poster generated successfully!`,
        isGenerating: false,
      }))

      setTimeout(() => {
        setState((prev) => ({ ...prev, success: '' }))
      }, 4000)
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to generate poster'
      const isTimeout = errorMsg.includes('timed out') || errorMsg.includes('504')
      
      setState((prev) => ({
        ...prev,
        error: isTimeout 
          ? 'Map generation timed out. Try reducing the distance or using a different city.'
          : errorMsg,
        isGenerating: false,
      }))
    }
  }
  const displayName = normalizeProfileField(profileName) || user?.email?.split('@')[0] || 'Guest account'

  return (
    <div className="flex flex-col h-screen bg-background text-on-background overflow-hidden">
      {/* TopNavBar */}
      <header className="fixed top-0 w-full z-40 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/15 dark:border-slate-800/15 shadow-sm dark:shadow-none">
        <div className="flex justify-between items-center h-16 px-8 w-full">
          <div className="text-xl font-bold tracking-tighter text-slate-900 dark:text-slate-50">
            MAPOSTER
          </div>
          <nav className="hidden md:flex items-center gap-8 font-inter tracking-tight">
            <button
              onClick={() => setActiveTab('editor')}
              className={`transition-colors pb-1 border-b-2 ${
                activeTab === 'editor'
                  ? 'text-slate-900 dark:text-white font-semibold border-slate-900 dark:border-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border-transparent'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`transition-colors pb-1 border-b-2 ${
                activeTab === 'gallery'
                  ? 'text-slate-900 dark:text-white font-semibold border-slate-900 dark:border-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border-transparent'
              }`}
            >
              Gallery
            </button>
            <button
              onClick={() => setActiveTab('journal')}
              className={`transition-colors pb-1 border-b-2 ${
                activeTab === 'journal'
                  ? 'text-slate-900 dark:text-white font-semibold border-slate-900 dark:border-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border-transparent'
              }`}
            >
              Journal
            </button>
          </nav>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('account')}
              className="p-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-md transition-colors"
            >
              <span className="material-symbols-outlined text-slate-900 dark:text-slate-50">account_circle</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 pt-16 overflow-hidden">
        {activeTab === 'editor' && (
          <>
            {/* SideBar */}
            <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-80 bg-slate-50 dark:bg-slate-950 border-r border-slate-200/15 dark:border-slate-800/15 flex flex-col p-6 gap-y-8 overflow-y-auto z-30">
              <div className="space-y-1">
                <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-slate-50">The Curated Cartographer</h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Create your masterpiece</p>
              </div>

              <div className="space-y-6">
                {/* Location Search */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">Location Search</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search a city..."
                      value={state.location}
                      onChange={handleLocationSearch}
                      className="w-full bg-surface-container-low border-none rounded-lg py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-highest transition-all"
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl">search</span>

                    {showSearchResults && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                        {searchResults.map((city, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectCity(city)}
                            className="px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-slate-900 dark:text-white">{city.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{city.country}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Typography & Details - Only show after city is selected */}
                {selectedCity && (
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">Typography & Details</label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Main Title"
                      value={state.title}
                      onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-surface-container-low border-none rounded-lg py-3 px-4 text-sm focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-highest transition-all"
                    />
                    <input
                      type="text"
                      placeholder="Subtitle"
                      value={state.subtitle}
                      onChange={(e) => setState((prev) => ({ ...prev, subtitle: e.target.value }))}
                      className="w-full bg-surface-container-low border-none rounded-lg py-3 px-4 text-sm focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-highest transition-all"
                    />
                    <input
                      type="text"
                      placeholder="Coordinates"
                      value={state.coordinates}
                      onChange={(e) => setState((prev) => ({ ...prev, coordinates: e.target.value }))}
                      className="w-full bg-surface-container-low border-none rounded-lg py-3 px-4 text-sm focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-highest transition-all"
                    />
                  </div>
                </div>
                )}

                {/* Distance Slider */}
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">Map Distance</label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="5000"
                      max="40000"
                      step="1000"
                      value={state.distance}
                      onChange={(e) => setState((prev) => ({ ...prev, distance: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-surface-container-low rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-on-surface-variant/60">
                      <span>5 km</span>
                      <span className="font-semibold text-on-surface">{(state.distance / 1000).toFixed(1)} km</span>
                      <span>40 km</span>
                    </div>
                  </div>
                </div>

                {/* Theme Selector */}
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">Map Aesthetic</label>
                  <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto p-2 auto-rows-min">
                    {themes.map((theme) => {
                      const bgColor = theme.colors?.[1] || '#d9d9d9'  // road_motorway color
                      // Determine if text should be light or dark based on background brightness
                      const rgb = parseInt(bgColor.slice(1), 16)
                      const r = (rgb >> 16) & 255
                      const g = (rgb >> 8) & 255
                      const b = rgb & 255
                      const brightness = (r * 299 + g * 587 + b * 114) / 1000
                      const textColor = brightness > 155 ? '#000000' : '#FFFFFF'
                      const borderColor = brightness > 155 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)'
                      
                      // Abbreviate specific long theme names
                      const abbreviationMap: { [key: string]: string } = {
                        'Monochrome Blue': 'Mono Blue',
                        'Neon Cyberpunk': 'Neon Cyber',
                        'Terracotta': 'Terra'
                      }
                      
                      const displayName = abbreviationMap[theme.name] || theme.name
                      
                      return (
                        <button
                          key={theme.id}
                          onClick={() => setState((prev) => ({ ...prev, selectedTheme: theme.id }))}
                          className={`h-16 w-full rounded-lg transition-all flex items-center justify-center px-2 py-2 text-center overflow-hidden ${
                            state.selectedTheme === theme.id ? 'scale-105' : 'hover:scale-105 opacity-80 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                            boxShadow: state.selectedTheme === theme.id ? `inset 0 0 0 2px ${borderColor}` : 'none'
                          }}
                          title={theme.name}
                        >
                          <span className="text-xs font-bold text-center leading-tight line-clamp-2">{displayName}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Layout & Size */}
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">Dimensions</label>
                  <select
                    value={state.size}
                    onChange={(e) => setState((prev) => ({ ...prev, size: e.target.value }))}
                    className="w-full bg-surface-container-low border-none rounded-lg py-3 px-4 text-sm focus:ring-2 focus:ring-primary/10 appearance-none"
                  >
                    <option value="18x24">18 x 24 inches</option>
                    <option value="24x36">24 x 36 inches</option>
                    <option value="50x70">50 x 70 cm</option>
                  </select>
                </div>

                {state.error && <div className="p-3 bg-error/10 text-error text-sm rounded-lg">{state.error}</div>}
                {state.success && <div className="p-3 bg-green-100 text-green-700 text-sm rounded-lg">{state.success}</div>}
              </div>

              {/* Generate Button */}
              <div className="mt-auto pt-6 border-t border-slate-200/10">
                <button
                  onClick={handleGenerate}
                  disabled={state.isGenerating || !selectedCity}
                  className="w-full py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold rounded-xl shadow-xl shadow-primary/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {state.isGenerating ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Generating map ...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">map</span>
                      Generate Map
                    </>
                  )}
                </button>
              </div>
            </aside>

            {/* Preview Canvas */}
            <main className="ml-80 flex-1 bg-surface-container-low flex items-center justify-center px-12 py-12 pt-40 overflow-auto">
              <div className="relative group mt-16">
                <div className="absolute -inset-4 bg-on-surface/5 blur-3xl rounded-[2rem] opacity-50"></div>
                <div ref={cardRef} className="relative w-[500px] aspect-[2/3] bg-white p-12 shadow-2xl flex flex-col ring-1 ring-black/5">
                  <div 
                    className="flex-1 relative overflow-hidden bg-slate-100 rounded-sm cursor-grab active:cursor-grabbing" 
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center', overflow: 'auto' }}
                    onWheel={handleWheel}
                  >
                    {generatedImageUrl ? (
                      <img src={generatedImageUrl} alt="Generated poster" className="w-full h-full object-cover pointer-events-none" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-slate-400 text-center">
                          {state.isGenerating ? 'Generating map...' : 'Map preview will appear here'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-10 space-y-1 text-center">
                    <h2 className="text-4xl font-extrabold tracking-tighter text-slate-900">{state.title}</h2>
                    <div className="flex items-center justify-center gap-4 py-2">
                      <div className="h-px w-8 bg-slate-200"></div>
                      <p className="text-[10px] tracking-[0.3em] font-medium text-slate-500 uppercase">{state.subtitle}</p>
                      <div className="h-px w-8 bg-slate-200"></div>
                    </div>
                    <p className="text-[9px] font-mono tracking-widest text-slate-400">{state.coordinates}</p>
                  </div>
                </div>

                <div className="absolute -right-16 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                  <button 
                    onClick={handleZoom}
                    title={`Zoom: ${Math.round(zoomLevel * 100)}%`}
                    className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md shadow-lg border border-white/20 flex items-center justify-center text-slate-700 hover:text-primary hover:bg-white transition-colors"
                  >
                    <span className="material-symbols-outlined">zoom_in</span>
                  </button>
                  <button 
                    onClick={() => setShowFullscreenModal(true)}
                    disabled={!generatedImageUrl}
                    className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md shadow-lg border border-white/20 flex items-center justify-center text-slate-700 hover:text-primary hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined">fullscreen</span>
                  </button>
                  <button 
                    onClick={handleShare}
                    disabled={!generatedImageUrl}
                    className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md shadow-lg border border-white/20 flex items-center justify-center text-slate-700 hover:text-primary hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined">share</span>
                  </button>
                </div>
              </div>
            </main>
          </>
        )}

        {/* Gallery Tab */}
        {activeTab === 'gallery' && (
          <main className="flex-1 p-8 overflow-y-auto bg-surface-container-low">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Gallery</h2>
                {selectedPosters.size > 0 && (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        let delay = 0
                        selectedPosters.forEach(id => {
                          setTimeout(() => {
                            const poster = posters.find(p => p.id === id)
                            if (poster) {
                              const link = document.createElement('a')
                              link.href = poster.url
                              link.download = `${poster.city}_${poster.theme}_${new Date().getTime()}.png`
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                            }
                          }, delay)
                          delay += 100
                        })
                      }}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <span className="material-symbols-outlined">download</span>
                      Download Selected ({selectedPosters.size})
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          const selected = posters.filter(p => selectedPosters.has(p.id))
                          if (selected.length === 0) return

                          const filenames = selected
                            .map(p => p.filename)
                            .filter((name): name is string => Boolean(name))
                          if (filenames.length === 0) return

                          const result = await mapApi.bulkDeletePosters(filenames)
                          const deletedFiles = new Set(result.deleted)
                          const deletedIds = new Set(
                            selected
                              .filter(p => p.filename && deletedFiles.has(p.filename))
                              .map(p => p.id)
                          )

                          setPosters(prev => prev.filter(p => !deletedIds.has(p.id)))
                          setSelectedPosters(new Set())
                          cleanupJournalData(deletedIds)

                          if (result.errors.length > 0) {
                            setState(prev => ({
                              ...prev,
                              error: `Some posters could not be deleted: ${result.errors.join(', ')}`,
                            }))
                          }
                        } catch (err) {
                          setState(prev => ({
                            ...prev,
                            error: err instanceof Error ? err.message : 'Failed to delete selected posters',
                          }))
                        }
                      }}
                      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      <span className="material-symbols-outlined">delete</span>
                      Delete Selected ({selectedPosters.size})
                    </button>
                  </div>
                )}
              </div>
              {posters.length > 0 ? (
                <div className="grid grid-cols-3 gap-6">
                  {posters.map((poster) => {
                    const isSelected = selectedPosters.has(poster.id)
                    return (
                    <div key={poster.id} className={`relative bg-white p-8 shadow-2xl flex flex-col ring-1 ring-black/5 rounded-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
                      {/* Checkbox */}
                      <div className="absolute top-3 right-3 z-10">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation()
                              const newSelected = new Set(selectedPosters)
                              if (isSelected) {
                                newSelected.delete(poster.id)
                              } else {
                                newSelected.add(poster.id)
                              }
                              setSelectedPosters(newSelected)
                            }}
                            className="sr-only"
                          />
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-md ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`}>
                            {isSelected && <span className="material-symbols-outlined text-white text-xs">check</span>}
                          </div>
                        </label>
                      </div>

                      <div onClick={() => {
                        if (selectedPosters.size === 0) {
                          setSelectedGalleryPoster(poster)
                          setShowGalleryModal(true)
                          setGalleryZoomLevel(1)
                        }
                      }}>
                        <div className="relative bg-slate-100 rounded-sm mb-8" style={{ aspectRatio: `${poster.width} / ${poster.height}` }}>
                          <img src={poster.url} alt={`${poster.city} - ${poster.theme}`} className="w-full h-full object-cover" />
                        </div>

                        <div className="space-y-3 text-center">
                          <h3 className="text-2xl font-extrabold tracking-tighter text-slate-900">{poster.city}</h3>
                          <div className="flex items-center justify-center gap-3 py-2">
                            <div className="h-px w-6 bg-slate-200"></div>
                            <p className="text-[9px] tracking-[0.2em] font-medium text-slate-500 uppercase">{poster.country || 'N/A'}</p>
                            <div className="h-px w-6 bg-slate-200"></div>
                          </div>
                          <p className="text-[8px] font-mono tracking-widest text-slate-400">
                            {(poster.latitude && poster.longitude) 
                              ? `${(typeof poster.latitude === 'number' ? poster.latitude : parseFloat(poster.latitude as string)).toFixed(4)}° / ${(typeof poster.longitude === 'number' ? poster.longitude : parseFloat(poster.longitude as string)).toFixed(4)}°`
                              : 'Coordinates unavailable'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-slate-500">No posters generated yet. Go to the Editor to create your first poster!</p>
                </div>
              )}
            </div>

            {/* Gallery Modal - Expand Gallery Poster */}
            {showGalleryModal && selectedGalleryPoster && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8 overflow-y-auto" onClick={() => setShowGalleryModal(false)}>
                <div className="relative my-auto" onClick={(e) => e.stopPropagation()}>
                  {/* Close Button */}
                  <button onClick={() => setShowGalleryModal(false)} className="fixed top-8 right-8 w-12 h-12 bg-white rounded-full p-2 shadow-lg hover:bg-slate-100 transition-colors z-50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl text-slate-900">close</span>
                  </button>

                  {/* Gallery Card - Same as preview card */}
                  <div className="relative w-[500px] aspect-[2/3] bg-white p-12 shadow-2xl flex flex-col ring-1 ring-black/5 rounded-xl" style={{
                    transform: `scale(${galleryZoomLevel})`,
                    transformOrigin: 'center',
                    transition: 'transform 0.2s ease'
                  }} onWheel={handleGalleryWheel}>
                    {/* Map Image */}
                    <div 
                      className="flex-1 relative overflow-hidden bg-slate-100 rounded-sm cursor-grab" 
                    >
                      <img src={selectedGalleryPoster.url} alt={`${selectedGalleryPoster.city}`} className="w-full h-full object-cover pointer-events-none" />
                    </div>

                    {/* Card Info */}
                    <div className="mt-10 space-y-1 text-center">
                      <h2 className="text-4xl font-extrabold tracking-tighter text-slate-900">{selectedGalleryPoster.city}</h2>
                      <div className="flex items-center justify-center gap-4 py-2">
                        <div className="h-px w-8 bg-slate-200"></div>
                        <p className="text-[10px] tracking-[0.3em] font-medium text-slate-500 uppercase">{selectedGalleryPoster.country || 'N/A'}</p>
                        <div className="h-px w-8 bg-slate-200"></div>
                      </div>
                      <p className="text-[9px] font-mono tracking-widest text-slate-400">
                        {selectedGalleryPoster.latitude && selectedGalleryPoster.longitude 
                          ? `${(selectedGalleryPoster.latitude as number).toFixed(4)}° / ${(selectedGalleryPoster.longitude as number).toFixed(4)}°`
                          : 'Coordinates unavailable'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="absolute -right-20 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                    <button 
                      onClick={() => setGalleryZoomLevel(prev => prev < 3 ? prev + 0.5 : 1)}
                      title={`Zoom: ${Math.round(galleryZoomLevel * 100)}%`}
                      className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md shadow-lg border border-white/20 flex items-center justify-center text-slate-700 hover:text-primary hover:bg-white transition-colors"
                    >
                      <span className="material-symbols-outlined">zoom_in</span>
                    </button>
                    <button 
                      onClick={handleGalleryShare}
                      className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md shadow-lg border border-white/20 flex items-center justify-center text-slate-700 hover:text-primary hover:bg-white transition-colors"
                    >
                      <span className="material-symbols-outlined">share</span>
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          if (!selectedGalleryPoster.filename) {
                            setState(prev => ({ ...prev, error: 'Poster filename is missing' }))
                            return
                          }

                          await mapApi.deletePoster(selectedGalleryPoster.filename)

                          const deletedIds = new Set([selectedGalleryPoster.id])
                          setPosters(prev => prev.filter(p => p.id !== selectedGalleryPoster.id))
                          setSelectedPosters(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(selectedGalleryPoster.id)
                            return newSet
                          })
                          cleanupJournalData(deletedIds)
                          setShowGalleryModal(false)
                        } catch (err) {
                          setState(prev => ({
                            ...prev,
                            error: err instanceof Error ? err.message : 'Failed to delete poster',
                          }))
                        }
                      }}
                      className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md shadow-lg border border-white/20 flex items-center justify-center text-slate-700 hover:text-red-500 hover:bg-white transition-colors"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        )}

        {/* Journal Tab */}
        {activeTab === 'journal' && (
          <main className="flex-1 p-8 overflow-y-auto bg-surface-container-low">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Journal & Library</h2>
              
              {/* Statistics & Analytics Section */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md">
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase">Total Posters</p>
                  <p className="text-4xl font-bold text-primary mt-2">{posters.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md">
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase">Unique Cities</p>
                  <p className="text-4xl font-bold text-blue-500 mt-2">{new Set(posters.map(p => p.city)).size}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md">
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase">Countries</p>
                  <p className="text-4xl font-bold text-green-500 mt-2">{new Set(posters.map(p => p.country)).size}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md">
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase">Favorites</p>
                  <p className="text-4xl font-bold text-red-500 mt-2">{favorites.size}</p>
                </div>
              </div>

              {/* Theme Analytics */}
              {posters.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md mb-8">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Theme Distribution</h3>
                  <div className="flex flex-wrap gap-3">
                    {Array.from(new Set(posters.map(p => p.theme))).map(theme => {
                      const count = posters.filter(p => p.theme === theme).length
                      return (
                        <div key={theme} className="bg-primary/10 rounded-lg p-4">
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{getThemeDisplayName(theme)}</p>
                          <p className="text-2xl font-bold text-primary mt-1">{count}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tabs for Collections, Favorites, Notes */}
              <div className="flex gap-4 mb-6">
                <button onClick={() => setCurrentCollectionView(null)} className={`px-4 py-2 rounded-lg font-medium transition-colors ${!currentCollectionView ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white'}`}>
                  All Posters
                </button>
                <button onClick={() => setCurrentCollectionView('favorites')} className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${currentCollectionView === 'favorites' ? 'bg-red-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white'}`}>
                  <span className="material-symbols-outlined">star</span>
                  Favorites ({favorites.size})
                </button>
                <button onClick={() => setCurrentCollectionView('collections')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentCollectionView === 'collections' ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white'}`}>
                  Collections ({Object.keys(collections).length})
                </button>
              </div>

              {/* Collections Management */}
              {currentCollectionView === 'collections' && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md mb-8">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Create Collection</h3>
                  <div className="flex gap-2 mb-6">
                    <input
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="Collection name..."
                      className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                    />
                    <button
                      onClick={async () => {
                        if (newCollectionName.trim()) {
                          const name = newCollectionName.trim()
                          const { data, error } = await supabase
                            .from('collections')
                            .insert({ name })
                            .select('id,name')
                            .single()

                          if (error || !data) {
                            setState((prev) => ({ ...prev, error: 'Failed to create collection' }))
                            return
                          }

                          setCollections(prev => ({
                            ...prev,
                            [data.name]: []
                          }))
                          setCollectionIdsByName(prev => ({
                            ...prev,
                            [data.name]: data.id,
                          }))
                          setNewCollectionName('')
                        }
                      }}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                    >
                      Create
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {Object.entries(collections).map(([collName, posterIds]) => (
                      <div key={collName} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors" onClick={() => setCurrentCollectionView(collName)}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">{collName}</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{posterIds.length} poster(s)</p>
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              const collectionId = collectionIdsByName[collName]
                              if (collectionId) {
                                const { error } = await supabase
                                  .from('collections')
                                  .delete()
                                  .eq('id', collectionId)
                                if (error) {
                                  setState((prev) => ({ ...prev, error: 'Failed to delete collection' }))
                                  return
                                }
                              }
                              setCollections(prev => {
                                const newColl = {...prev}
                                delete newColl[collName]
                                return newColl
                              })
                              setCollectionIdsByName(prev => {
                                const next = { ...prev }
                                delete next[collName]
                                return next
                              })
                            }}
                            className="text-red-500 hover:text-red-700 material-symbols-outlined"
                          >
                            delete
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {posters.filter(p => posterIds.includes(p.id)).map(p => (
                            <span key={p.id} className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-medium">
                              {p.city}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Display Posters Grid with Actions */}
              {posters.length > 0 && currentCollectionView !== 'collections' && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {currentCollectionView === 'favorites' ? 'Your Favorites' : currentCollectionView ? currentCollectionView : 'All Posters'}
                    </h3>
                    {currentCollectionView && currentCollectionView !== 'favorites' && (
                      <button
                        onClick={() => setCurrentCollectionView('collections')}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Back to Collections
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {posters
                      .filter(poster => {
                        if (currentCollectionView === 'favorites') return favorites.has(poster.id)
                        if (currentCollectionView && currentCollectionView !== 'favorites' && currentCollectionView !== 'collections') {
                          return collections[currentCollectionView]?.includes(poster.id) || false
                        }
                        return true
                      })
                      .map(poster => (
                        <div key={poster.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                          <div className="relative bg-slate-100 h-40 overflow-hidden">
                            <img src={poster.url} alt={poster.city} className="w-full h-full object-cover" />
                            <button
                              onClick={async () => {
                                const isFav = favorites.has(poster.id)
                                setFavorites(prev => {
                                  const newFav = new Set(prev)
                                  if (isFav) {
                                    newFav.delete(poster.id)
                                  } else {
                                    newFav.add(poster.id)
                                  }
                                  return newFav
                                })

                                if (isFav) {
                                  const { error } = await supabase
                                    .from('favorites')
                                    .delete()
                                    .eq('poster_id', poster.id)
                                  if (error) {
                                    setState((prev) => ({ ...prev, error: 'Failed to remove favorite' }))
                                  }
                                } else {
                                  const { error } = await supabase
                                    .from('favorites')
                                    .insert({ poster_id: poster.id })
                                  if (error) {
                                    setState((prev) => ({ ...prev, error: 'Failed to save favorite' }))
                                  }
                                }
                              }}
                              className={`absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                favorites.has(poster.id) ? 'bg-yellow-400' : 'bg-white/80'
                              }`}
                            >
                              <span className="material-symbols-outlined text-lg">star</span>
                            </button>
                          </div>
                          <div className="p-4">
                            <h4 className="font-semibold text-slate-900 dark:text-white">{poster.city}, {poster.country}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Theme: {getThemeDisplayName(poster.theme)}</p>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => {
                                  setNoteModalPoster(poster)
                                  setTempNoteText(notes[poster.id]?.note || '')
                                  setTempNoteMood(notes[poster.id]?.mood || null)
                                  setShowNoteModal(true)
                                }}
                                className="flex-1 flex items-center justify-center gap-1 text-sm bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">note_add</span>
                                Note
                              </button>
                              <select
                                onChange={async (e) => {
                                  if (e.target.value && e.target.value !== 'select') {
                                    const collName = e.target.value
                                    const collectionId = collectionIdsByName[collName]
                                    if (!collectionId) {
                                      setState((prev) => ({ ...prev, error: 'Collection id not found' }))
                                      return
                                    }

                                    setCollections(prev => ({
                                      ...prev,
                                      [collName]: (prev[collName] || []).includes(poster.id)
                                        ? (prev[collName] || [])
                                        : [...(prev[collName] || []), poster.id]
                                    }))

                                    const { error } = await supabase
                                      .from('collection_items')
                                      .upsert(
                                        { collection_id: collectionId, poster_id: poster.id },
                                        { onConflict: 'collection_id,poster_id', ignoreDuplicates: true }
                                      )
                                    if (error) {
                                      setState((prev) => ({ ...prev, error: 'Failed to add poster to collection' }))
                                    }
                                  }
                                }}
                                className="flex-1 text-sm bg-green-500 text-white px-2 py-2 rounded hover:bg-green-600 transition-colors cursor-pointer"
                              >
                                <option value="select">Add to Collection</option>
                                {Object.keys(collections).map(collName => (
                                  <option key={collName} value={collName}>{collName}</option>
                                ))}
                              </select>
                            </div>
                            {notes[poster.id] && (
                              <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                                <p className="text-sm text-slate-600 dark:text-slate-300">{notes[poster.id].note}</p>
                                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                                  {notes[poster.id].mood && <span className="text-lg">{notes[poster.id].mood}</span>}
                                  <span>{notes[poster.id].date}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Note Modal */}
            {showNoteModal && noteModalPoster && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                      Add Note - {noteModalPoster.city}
                    </h3>
                    <button
                      onClick={() => {
                        setShowNoteModal(false)
                        setTempNoteText('')
                        setTempNoteMood(null)
                      }}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  
                  <textarea
                    value={tempNoteText}
                    onChange={(e) => setTempNoteText(e.target.value)}
                    placeholder="Write your memories and thoughts..."
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg mb-4 dark:bg-slate-700 dark:text-white min-h-24"
                  />
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">How did you feel?</p>
                    <div className="flex gap-2">
                      {['😊', '😍', '😎', '🤔', '😢'].map(mood => (
                        <button
                          key={mood}
                          onClick={() => setTempNoteMood(mood)}
                          className={`text-3xl p-2 rounded ${tempNoteMood === mood ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                          {mood}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setNotes(prev => {
                          const newNotes = {...prev}
                          delete newNotes[noteModalPoster.id]
                          return newNotes
                        })

                        const { error } = await supabase
                          .from('notes')
                          .delete()
                          .eq('poster_id', noteModalPoster.id)
                        if (error) {
                          setState((prev) => ({ ...prev, error: 'Failed to delete note' }))
                        }

                        setShowNoteModal(false)
                        setTempNoteText('')
                        setTempNoteMood(null)
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        setShowNoteModal(false)
                        setTempNoteText('')
                        setTempNoteMood(null)
                      }}
                      className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (tempNoteText.trim()) {
                          const payload = {
                            poster_id: noteModalPoster.id,
                            note: tempNoteText,
                            mood: tempNoteMood || null,
                          }
                          const { error } = await supabase.from('notes').upsert(payload)
                          if (error) {
                            setState((prev) => ({ ...prev, error: 'Failed to save note' }))
                            return
                          }

                          setNotes(prev => ({
                            ...prev,
                            [noteModalPoster.id]: {
                              note: tempNoteText,
                              mood: tempNoteMood || undefined,
                              date: notes[noteModalPoster.id]?.date || new Date().toLocaleDateString()
                            }
                          }))
                        } else {
                          await supabase
                            .from('notes')
                            .delete()
                            .eq('poster_id', noteModalPoster.id)

                          setNotes(prev => {
                            const newNotes = {...prev}
                            delete newNotes[noteModalPoster.id]
                            return newNotes
                          })
                        }
                        setShowNoteModal(false)
                        setTempNoteText('')
                        setTempNoteMood(null)
                      }}
                      className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <main className="flex-1 p-8 overflow-y-auto bg-gradient-to-b from-slate-50 to-slate-100/70 dark:from-slate-950 dark:to-slate-900">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Account Settings</h2>
              <div className="space-y-6">
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200/70 dark:border-slate-700/70 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center gap-4 mb-6">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-3xl">account_circle</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-2xl font-semibold text-slate-900 dark:text-white truncate">{displayName}</h3>
                      <p className="text-slate-500 dark:text-slate-400 truncate">{user?.email || 'Guest account'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">ID: {user?.id?.slice(0, 8)}...</span>
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">{user?.is_anonymous ? 'Guest' : 'Registered'}</span>
                      </div>
                    </div>
                    {!isProfileEditing && (
                      <button
                        onClick={() => {
                          setIsProfileEditing(true)
                          setAccountMessage('')
                        }}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        Edit Profile
                      </button>
                    )}
                  </div>
                  {!isProfileEditing && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400">Profile details are hidden until you choose to edit.</p>
                    </div>
                  )}

                  {isProfileEditing && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <input
                          value={profileName}
                          onChange={(e) => {
                            setProfileName(e.target.value)
                            setAccountMessage('')
                          }}
                          placeholder="Display name"
                          className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                        />
                        <input
                          value={avatarUrl}
                          onChange={(e) => {
                            setAvatarUrl(e.target.value)
                            setAccountMessage('')
                          }}
                          placeholder="Avatar image URL"
                          className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <label className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors cursor-pointer dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600">
                          Add from Device
                          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
                        </label>
                        <button
                          onClick={() => void saveProfile()}
                          disabled={isProfileSaving}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {isProfileSaving ? 'Saving...' : 'Save Profile'}
                        </button>
                        <button
                          onClick={cancelProfileEdit}
                          disabled={isProfileSaving}
                          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
                    <button
                      onClick={() => void signOut()}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200/70 dark:border-slate-700/70 rounded-2xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Session & Security</h3>
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-4">
                    <p>Account type: <span className="font-semibold">{user?.is_anonymous ? 'Guest (Anonymous)' : 'Authenticated'}</span></p>
                    <p>Created: <span className="font-semibold">{user?.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</span></p>
                    <p>Last sign-in: <span className="font-semibold">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}</span></p>
                    <p>Session expires: <span className="font-semibold">{session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A'}</span></p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void refreshSession()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Refresh Session
                    </button>
                    {user?.is_anonymous && (
                      <button
                        disabled
                        className="px-4 py-2 bg-slate-200 text-slate-500 rounded-lg cursor-not-allowed"
                        title="Upgrade flow can be added later (Google or Email)"
                      >
                        Upgrade Account (Coming Soon)
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200/70 dark:border-slate-700/70 rounded-2xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Data & Privacy</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      onClick={exportMyData}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Export My Data
                    </button>
                    <button
                      onClick={() => void clearJournalData()}
                      disabled={isAccountActionLoading}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      Clear Journal Data
                    </button>
                    <button
                      onClick={() => void deleteAllMyPosters()}
                      disabled={isAccountActionLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Delete All Posters
                    </button>
                    <button
                      onClick={() => void deleteAllMyData()}
                      disabled={isAccountActionLoading}
                      className="px-4 py-2 bg-red-900 text-white rounded-lg hover:bg-red-950 transition-colors disabled:opacity-50"
                    >
                      Delete All My Data
                    </button>
                  </div>
                  {accountMessage && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">{accountMessage}</p>
                  )}
                </div>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* Mobile Footer */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex justify-around items-center p-4 z-40">
        <button onClick={() => setActiveTab('editor')} className={`flex flex-col items-center gap-1 ${activeTab === 'editor' ? 'text-primary' : 'text-slate-400'}`}>
          <span className="material-symbols-outlined">palette</span>
          <span className="text-[10px] font-bold uppercase tracking-tight">Editor</span>
        </button>
        <button onClick={() => setActiveTab('gallery')} className={`flex flex-col items-center gap-1 ${activeTab === 'gallery' ? 'text-primary' : 'text-slate-400'}`}>
          <span className="material-symbols-outlined">image</span>
          <span className="text-[10px] font-bold uppercase tracking-tight">Gallery</span>
        </button>
        <button onClick={() => setActiveTab('journal')} className={`flex flex-col items-center gap-1 ${activeTab === 'journal' ? 'text-primary' : 'text-slate-400'}`}>
          <span className="material-symbols-outlined">menu_book</span>
          <span className="text-[10px] font-bold uppercase tracking-tight">Journal</span>
        </button>
        <button onClick={() => setActiveTab('account')} className={`flex flex-col items-center gap-1 ${activeTab === 'account' ? 'text-primary' : 'text-slate-400'}`}>
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-bold uppercase tracking-tight">Account</span>
        </button>
      </div>

      {/* Fullscreen Modal */}
      {showFullscreenModal && generatedImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center overflow-auto"
        >
          <div className="relative w-full max-w-[600px] flex items-center justify-center p-4 my-auto">
            {/* Fullscreen Card - Same layout as preview card */}
            <div 
              className="relative w-[500px] aspect-[2/3] bg-white p-12 shadow-2xl flex flex-col ring-1 ring-black/5 rounded-lg cursor-grab active:cursor-grabbing"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center' }}
              onWheel={handleWheel}
            >
              {/* Image Container */}
              <div className="flex-1 relative overflow-hidden bg-slate-100 rounded-sm mb-8">
                <img 
                  src={generatedImageUrl} 
                  alt="Fullscreen Poster" 
                  className="w-full h-full object-cover pointer-events-none"
                />
              </div>
              
              {/* Text Information */}
              <div className="space-y-1 text-center">
                <h2 className="text-2xl font-extrabold tracking-tighter text-slate-900">{state.title}</h2>
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="h-px w-6 bg-slate-200"></div>
                  <p className="text-[9px] tracking-[0.2em] font-medium text-slate-500 uppercase">{state.subtitle}</p>
                  <div className="h-px w-6 bg-slate-200"></div>
                </div>
                <p className="text-[8px] font-mono tracking-wider text-slate-400">{state.coordinates}</p>
              </div>
            </div>
          </div>
          
          {/* Close Button - Positioned on overlay */}
          <button 
            onClick={() => {
              setShowFullscreenModal(false)
              setZoomLevel(1)
            }}
            className="fixed top-8 right-8 w-12 h-12 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-slate-700 transition-all z-50"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  )
}
