export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          monthly_budget: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          monthly_budget?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          monthly_budget?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      family_members: {
        Row: {
          id: string
          family_id: string
          name: string
          dietary_restrictions: string[] | null
          favorite_ingredients: string[] | null
          favorite_cuisines: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          dietary_restrictions?: string[] | null
          favorite_ingredients?: string[] | null
          favorite_cuisines?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          dietary_restrictions?: string[] | null
          favorite_ingredients?: string[] | null
          favorite_cuisines?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      recipes: {
        Row: {
          id: string
          family_id: string
          name: string
          description: string | null
          ingredients: Json
          instructions: string[]
          prep_time_minutes: number | null
          cook_time_minutes: number | null
          servings: number
          tags: string[] | null
          photo_url: string | null
          source_url: string | null
          cost_estimate: number | null
          cost_bucket: 'budget' | 'moderate' | 'splurge' | null
          complexity: 'quick' | 'complex'
          last_made_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          description?: string | null
          ingredients: Json
          instructions: string[]
          prep_time_minutes?: number | null
          cook_time_minutes?: number | null
          servings: number
          tags?: string[] | null
          photo_url?: string | null
          source_url?: string | null
          cost_estimate?: number | null
          cost_bucket?: 'budget' | 'moderate' | 'splurge' | null
          complexity?: 'quick' | 'complex'
          last_made_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          description?: string | null
          ingredients?: Json
          instructions?: string[]
          prep_time_minutes?: number | null
          cook_time_minutes?: number | null
          servings?: number
          tags?: string[] | null
          photo_url?: string | null
          source_url?: string | null
          cost_estimate?: number | null
          cost_bucket?: 'budget' | 'moderate' | 'splurge' | null
          complexity?: 'quick' | 'complex'
          last_made_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      recipe_ratings: {
        Row: {
          id: string
          recipe_id: string
          family_member_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recipe_id: string
          family_member_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recipe_id?: string
          family_member_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
      }
      inventory_items: {
        Row: {
          id: string
          family_id: string
          name: string
          category: 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen'
          quantity_level: 'low' | 'medium' | 'full'
          expiration_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          category: 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen'
          quantity_level?: 'low' | 'medium' | 'full'
          expiration_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          category?: 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen'
          quantity_level?: 'low' | 'medium' | 'full'
          expiration_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      meal_plans: {
        Row: {
          id: string
          family_id: string
          recipe_id: string
          planned_date: string
          is_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          recipe_id: string
          planned_date: string
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          recipe_id?: string
          planned_date?: string
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      grocery_list_items: {
        Row: {
          id: string
          family_id: string
          name: string
          quantity: string | null
          category: string | null
          is_checked: boolean
          recipe_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          quantity?: string | null
          category?: string | null
          is_checked?: boolean
          recipe_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          quantity?: string | null
          category?: string | null
          is_checked?: boolean
          recipe_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      seasonal_produce: {
        Row: {
          id: string
          name: string
          category: string
          months: number[]
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          months: number[]
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          months?: number[]
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
