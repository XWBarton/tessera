export interface User {
  id: number
  username: string
  full_name: string
  email: string
  is_admin: boolean
  is_active: boolean
  avatar_filename?: string
  created_at: string
}

export interface Project {
  id: number
  code: string
  name: string
  description?: string
  created_by: number
  created_at: string
}

export interface Species {
  id: number
  scientific_name: string
  common_name?: string
  notes?: string
  created_at: string
}

export interface SiteProject {
  id: number
  code: string
  name: string
}

export interface Site {
  id: number
  name: string
  description?: string
  habitat_type?: string
  lat?: number
  lon?: number
  precision?: string
  notes?: string
  created_at: string
  projects?: SiteProject[]
}

export interface SpecimenSpecies {
  id: number
  specimen_id: number
  species_id?: number
  free_text_species?: string
  specimen_count?: number
  life_stage?: string
  sex?: string
  confidence: 'Confirmed' | 'Probable' | 'Possible' | 'Unknown'
  created_at: string
  species?: Species
}

export interface Specimen {
  id: number
  specimen_code: string
  project_id: number
  sequence_number: number
  collection_date?: string
  collection_date_end?: string
  collector_id?: number
  collector_name?: string
  entered_by_id: number
  site_ids?: number[]
  sample_type_id?: number
  quantity_value?: number
  quantity_unit?: string
  quantity_remaining?: number
  collection_lat?: number
  collection_lon?: number
  collection_location_text?: string
  storage_location?: string
  notes?: string
  created_at: string
  updated_at: string
  project?: Project
  collector?: User
  entered_by?: User
  sites: Site[]
  sample_type?: SampleType
  species_associations: SpecimenSpecies[]
}

export interface SpecimenList {
  items: Specimen[]
  total: number
  skip: number
  limit: number
}

export interface Token {
  access_token: string
  token_type: string
}

export interface SpecimenSpeciesCreate {
  species_id?: number | null
  free_text_species?: string
  specimen_count?: number | null
  life_stage?: string | null
  sex?: string | null
  confidence: string
}

export interface SpecimenCreate {
  specimen_code?: string
  project_id: number
  collection_date?: string
  collection_date_end?: string
  collector_id?: number
  collector_name?: string
  site_ids?: number[]
  sample_type_id?: number
  quantity_value?: number
  quantity_unit?: string
  collection_lat?: number
  collection_lon?: number
  collection_location_text?: string
  storage_location?: string
  notes?: string
  species_associations: SpecimenSpeciesCreate[]
}

export interface SpecimenUpdate {
  specimen_code?: string
  project_id?: number
  collection_date?: string
  collection_date_end?: string
  collector_id?: number
  collector_name?: string
  site_ids?: number[]
  sample_type_id?: number
  quantity_value?: number
  quantity_unit?: string
  quantity_remaining?: number
  collection_lat?: number
  collection_lon?: number
  collection_location_text?: string
  storage_location?: string
  notes?: string
  species_associations?: SpecimenSpeciesCreate[]
}

export interface BulkImportRow {
  specimen_code: string
  project_code: string
  collection_date?: string
  collection_date_end?: string
  collector_name?: string
  site_name?: string
  sample_type_name?: string
  quantity_value?: number
  quantity_unit?: string
  storage_location?: string
  notes?: string
  species?: string
}

export interface BulkImportResult {
  created: number
  errors: string[]
}

export interface SampleType {
  id: number
  name: string
  default_unit?: string
  is_default: boolean
  is_specimen: boolean
  created_at: string
}

export interface SampleTypeCreate {
  name: string
  default_unit?: string
  is_specimen?: boolean
}

export interface BreakdownItem {
  label: string
  count: number
}

export interface TubeUsageLog {
  id: number
  specimen_id: number
  date: string
  quantity_taken: number
  unit: string
  purpose?: string
  molecular_ref?: string
  non_destructive: boolean
  destination_tube?: string
  breakdown?: BreakdownItem[]
  notes?: string
  created_at: string
  taken_by?: User
}

export interface TubeUsageLogCreate {
  date: string
  quantity_taken: number
  unit: string
  purpose?: string
  molecular_ref?: string
  non_destructive?: boolean
  destination_tube?: string
  breakdown?: BreakdownItem[]
  notes?: string
}

export interface SiteCreate {
  name: string
  description?: string
  habitat_type?: string
  lat?: number
  lon?: number
  precision?: string
  notes?: string
  project_ids?: number[]
}

export interface SiteUpdate {
  name?: string
  description?: string
  habitat_type?: string
  lat?: number
  lon?: number
  precision?: string
  notes?: string
  project_ids?: number[]
}

export interface SpecimenPhoto {
  id: number
  specimen_id: number
  filename: string
  original_filename: string
  caption?: string
  uploaded_by_id: number
  uploaded_at: string
  uploaded_by?: { id: number; full_name: string }
}

export interface SpecimenFilters {
  project_id?: number
  collector_id?: number
  species_id?: number
  confidence?: string
  life_stage?: string
  sex?: string
  date_from?: string
  date_to?: string
  search?: string
  sort_by?: string
  sort_dir?: string
  skip?: number
  limit?: number
}
