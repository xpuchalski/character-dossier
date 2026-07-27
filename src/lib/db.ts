import Dexie, { Table } from 'dexie'

export interface ImageRef {
  id: string
  caption?: string
}

export interface ImageBlob {
  id: string
  characterId: string
  blob: Blob
  caption?: string
  createdAt: Date
}

export interface Section {
  id: string
  title: string
  content: string
  collapsed?: boolean
}

export interface Relationship {
  id: string
  name: string
  type: string
  notes?: string
  position?: { x: number; y: number }
  connected?: boolean
}

export interface TimelineEvent {
  id: string
  date: string
  title: string
  notes?: string
}

export interface IdentityField {
  id: string
  key: string
  label: string
  value: string
  removable: boolean
}

export interface ThemeSettings {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
}

export interface Character {
  id: string
  name: string
  basicInfo: Record<string, string>
  identityFields: IdentityField[]
  images: ImageRef[]
  biography: string
  customSections: Section[]
  relationships: Relationship[]
  timeline: TimelineEvent[]
  tags: string[]
  notes?: string
  sectionOrder: string[]
  sectionCollapsed?: Record<string, boolean>
  sectionCols?: Record<string, number>
  sectionPositions?: Record<string, { x: number; y: number }>
  sectionSizes?: Record<string, { width: number; height: number }>
  theme: ThemeSettings
  customCss: string
  createdAt: Date
  updatedAt: Date
}

class CharacterDB extends Dexie {
  characters!: Table<Character, string>
  images!: Table<ImageBlob, string>

  constructor() {
    super('CharacterDossierDB')
    this.version(4).stores({
      characters: '&id,name,updatedAt',
      images: '&id,characterId,createdAt'
    })
  }
}

export const db = new CharacterDB()
