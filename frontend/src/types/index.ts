export interface City {
  id: string
  name: string
  country: string
  latitude?: number
  longitude?: number
}

export interface Theme {
  id: string
  name: string
  colors: string[]
  description?: string
}

export interface GeneratedPoster {
  id: string
  city: string
  country?: string
  latitude?: number
  longitude?: number
  theme: string
  url: string
  timestamp: number
  width: number
  height: number
  filename?: string
}

export interface MapGenerationParams {
  city: string
  country: string
  latitude?: number
  longitude?: number
  theme: string
  distance?: number
  width: number
  height: number
  dpi?: number
  layers?: string[]
  roadThickness?: number
  customLabel?: string
  fontFamily?: string
}
