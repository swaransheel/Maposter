import { City, Theme, GeneratedPoster, MapGenerationParams } from '../types'
import { supabase } from '../lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

class MapGeneratorAPI {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async getAuthHeaders(includeJson = false): Promise<Record<string, string>> {
    const headers: Record<string, string> = {}
    if (includeJson) {
      headers['Content-Type'] = 'application/json'
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }

    return headers
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; message: string; version: string }> {
    const response = await fetch(`${this.baseUrl}/health`)
    if (!response.ok) {
      throw new Error('Health check failed')
    }
    return response.json()
  }

  /**
   * Get all available themes
   */
  async getThemes(): Promise<Theme[]> {
    const response = await fetch(`${this.baseUrl}/themes`)
    if (!response.ok) {
      throw new Error('Failed to fetch themes')
    }
    const data = await response.json()
    return data.themes || []
  }

  /**
   * Get all generated posters
   */
  async getPosters(): Promise<GeneratedPoster[]> {
    const response = await fetch(`${this.baseUrl}/posters`, {
      headers: await this.getAuthHeaders(),
    })
    if (!response.ok) {
      throw new Error('Failed to fetch posters')
    }
    const data = await response.json()
    
    // Map backend response to frontend format
    return (data.posters || []).map((poster: any) => ({
      id: poster.id,
      city: poster.city,
      country: poster.country,
      latitude: poster.latitude,
      longitude: poster.longitude,
      theme: poster.theme,
      url: `${this.baseUrl.replace('/api', '')}${poster.url}`,
      timestamp: poster.timestamp,
      width: 1080,
      height: 1350,
      filename: poster.filename,
    }))
  }

  /**
   * Search for cities
   */
  async searchCities(query: string): Promise<City[]> {
    const response = await fetch(`${this.baseUrl}/cities/search?q=${encodeURIComponent(query)}`)
    if (!response.ok) {
      throw new Error('Failed to search cities')
    }
    const data = await response.json()
    return data.cities || []
  }

  /**
   * Generate a new map poster
   */
  async generateMap(params: MapGenerationParams): Promise<GeneratedPoster> {
    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: await this.getAuthHeaders(true),
      body: JSON.stringify({
        city: params.city,
        country: params.country,
        theme: params.theme,
        latitude: params.latitude,
        longitude: params.longitude,
        distance: params.distance || 18000,
        width: params.width || 12,
        height: params.height || 16,
        dpi: params.dpi || 150,
        layers: params.layers || ['roads', 'water', 'parks'],
        road_thickness: params.roadThickness || 1.0,
        custom_label: params.customLabel || '',
        font_family: params.fontFamily || '',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to generate map')
    }

    const data = await response.json()
    
    // Map backend response to frontend format
    const poster = data.poster
    
    // Calculate pixel dimensions from poster paper size and DPI
    const posterDpi = params.dpi || 150
    const posterWidth = Math.round((params.width || 12) * posterDpi)
    const posterHeight = Math.round((params.height || 18) * posterDpi)
    
    return {
      id: poster.id,
      city: poster.city,
      country: params.country,
      latitude: params.latitude,
      longitude: params.longitude,
      theme: poster.theme,
      url: `${this.baseUrl.replace('/api', '')}${poster.url}`,
      timestamp: poster.timestamp,
      width: posterWidth,
      height: posterHeight,
      filename: poster.filename,
    }
  }

  /**
   * Download a poster
   */
  getPosterDownloadUrl(filename: string): string {
    return `${this.baseUrl}/posters/${filename}`
  }

  /**
   * Delete a single poster
   */
  async deletePoster(filename: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/posters/${filename}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete poster')
    }
  }

  /**
   * Delete multiple posters
   */
  async bulkDeletePosters(filenames: string[]): Promise<{ deleted: string[]; errors: string[] }> {
    const response = await fetch(`${this.baseUrl}/posters/bulk-delete`, {
      method: 'POST',
      headers: await this.getAuthHeaders(true),
      body: JSON.stringify({ filenames }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete posters')
    }

    const data = await response.json()
    return { deleted: data.deleted || [], errors: data.errors || [] }
  }
}

// Export singleton instance
export const mapApi = new MapGeneratorAPI()

// Export class for testing
export default MapGeneratorAPI
