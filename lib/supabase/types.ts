// Generated from the Supabase project (generate_typescript_types, 2026-11-13). Regenerate after a migration
// instead of editing by hand. Row = what you read, Insert = what you may write, Update = a partial write.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows createClient to pick up the right options without naming a version.
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      component_ingredients: {
        Row: {
          category: string;
          component_id: string;
          household_id: string;
          id: string;
          name: string;
          qty: number | null;
          sort: number;
          unit: string | null;
        };
        Insert: {
          category?: string;
          component_id: string;
          household_id: string;
          id?: string;
          name: string;
          qty?: number | null;
          sort?: number;
          unit?: string | null;
        };
        Update: {
          category?: string;
          component_id?: string;
          household_id?: string;
          id?: string;
          name?: string;
          qty?: number | null;
          sort?: number;
          unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "component_ingredients_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "components";
            referencedColumns: ["id"];
          },
        ];
      };
      components: {
        Row: { buy_as: string | null; buy_unit: string; created_at: string; household_id: string; id: string; name: string };
        Insert: { buy_as?: string | null; buy_unit?: string; created_at?: string; household_id: string; id?: string; name: string };
        Update: { buy_as?: string | null; buy_unit?: string; created_at?: string; household_id?: string; id?: string; name?: string };
        Relationships: [
          {
            foreignKeyName: "components_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      household_members: {
        Row: {
          created_at: string;
          display_name: string | null;
          eats_keto: boolean;
          household_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          eats_keto?: boolean;
          household_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          eats_keto?: boolean;
          household_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          default_protein_lbs: number;
          dinner_time: string;
          id: string;
          invite_code: string;
          kroger_location_id: string | null;
          kroger_store_name: string | null;
          name: string;
          thaw_reminder: boolean;
          zip: string | null;
        };
        Insert: {
          created_at?: string;
          default_protein_lbs?: number;
          dinner_time?: string;
          id?: string;
          invite_code?: string;
          kroger_location_id?: string | null;
          kroger_store_name?: string | null;
          name?: string;
          thaw_reminder?: boolean;
          zip?: string | null;
        };
        Update: {
          created_at?: string;
          default_protein_lbs?: number;
          dinner_time?: string;
          id?: string;
          invite_code?: string;
          kroger_location_id?: string | null;
          kroger_store_name?: string | null;
          name?: string;
          thaw_reminder?: boolean;
          zip?: string | null;
        };
        Relationships: [];
      };
      keepalive: {
        Row: { id: number; pinged_at: string };
        Insert: { id?: number; pinged_at?: string };
        Update: { id?: number; pinged_at?: string };
        Relationships: [];
      };
      kroger_connections: {
        Row: {
          access_token: string;
          expires_at: string;
          refresh_token: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token: string;
          expires_at: string;
          refresh_token?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token?: string;
          expires_at?: string;
          refresh_token?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      kroger_matches: {
        Row: {
          aisle: string | null;
          confidence: string | null;
          description: string | null;
          household_id: string;
          image_url: string | null;
          name_key: string;
          order_qty: number;
          price: number | null;
          product_id: string | null;
          qty_override: number | null;
          size: string | null;
          upc: string;
          updated_at: string;
        };
        Insert: {
          aisle?: string | null;
          confidence?: string | null;
          description?: string | null;
          household_id: string;
          image_url?: string | null;
          name_key: string;
          order_qty?: number;
          price?: number | null;
          product_id?: string | null;
          qty_override?: number | null;
          size?: string | null;
          upc: string;
          updated_at?: string;
        };
        Update: {
          aisle?: string | null;
          confidence?: string | null;
          description?: string | null;
          household_id?: string;
          image_url?: string | null;
          name_key?: string;
          order_qty?: number;
          price?: number | null;
          product_id?: string | null;
          qty_override?: number | null;
          size?: string | null;
          upc?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kroger_matches_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      pantry_staples: {
        Row: { created_at: string; household_id: string; name: string; name_key: string };
        Insert: { created_at?: string; household_id: string; name: string; name_key: string };
        Update: { created_at?: string; household_id?: string; name?: string; name_key?: string };
        Relationships: [
          {
            foreignKeyName: "pantry_staples_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      planned_meals: {
        Row: {
          created_at: string;
          day: string;
          household_id: string;
          id: string;
          kind: string;
          notes: string | null;
          protein_lbs: number | null;
          rating: number | null;
          recipe_id: string | null;
          slot: string;
          week_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          household_id: string;
          id?: string;
          kind?: string;
          notes?: string | null;
          protein_lbs?: number | null;
          rating?: number | null;
          recipe_id?: string | null;
          slot?: string;
          week_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          household_id?: string;
          id?: string;
          kind?: string;
          notes?: string | null;
          protein_lbs?: number | null;
          rating?: number | null;
          recipe_id?: string | null;
          slot?: string;
          week_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planned_meals_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planned_meals_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planned_meals_week_id_fkey";
            columns: ["week_id"];
            isOneToOne: false;
            referencedRelation: "weeks";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_ingredients: {
        Row: {
          category: string;
          component_id: string | null;
          family_only: boolean;
          from_scratch: boolean;
          household_id: string;
          id: string;
          name: string;
          note: string | null;
          qty: number | null;
          recipe_id: string;
          size: string | null;
          sort: number;
          unit: string | null;
        };
        Insert: {
          category?: string;
          component_id?: string | null;
          family_only?: boolean;
          from_scratch?: boolean;
          household_id: string;
          id?: string;
          name: string;
          note?: string | null;
          qty?: number | null;
          recipe_id: string;
          size?: string | null;
          sort?: number;
          unit?: string | null;
        };
        Update: {
          category?: string;
          component_id?: string | null;
          family_only?: boolean;
          from_scratch?: boolean;
          household_id?: string;
          id?: string;
          name?: string;
          note?: string | null;
          qty?: number | null;
          recipe_id?: string;
          size?: string | null;
          sort?: number;
          unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "components";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          archived: boolean;
          cook_minutes: number | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          diet: string;
          difficulty: string;
          favorite: boolean;
          household_id: string;
          id: string;
          image_url: string | null;
          keto_swap: string | null;
          name: string;
          notes: string | null;
          prep_minutes: number | null;
          rating: number | null;
          servings: number;
          slug: string | null;
          source: string;
          steps: string[];
          tags: string[];
        };
        Insert: {
          archived?: boolean;
          cook_minutes?: number | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          diet?: string;
          difficulty?: string;
          favorite?: boolean;
          household_id: string;
          id?: string;
          image_url?: string | null;
          keto_swap?: string | null;
          name: string;
          notes?: string | null;
          prep_minutes?: number | null;
          rating?: number | null;
          servings?: number;
          slug?: string | null;
          source?: string;
          steps?: string[];
          tags?: string[];
        };
        Update: {
          archived?: boolean;
          cook_minutes?: number | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          diet?: string;
          difficulty?: string;
          favorite?: boolean;
          household_id?: string;
          id?: string;
          image_url?: string | null;
          keto_swap?: string | null;
          name?: string;
          notes?: string | null;
          prep_minutes?: number | null;
          rating?: number | null;
          servings?: number;
          slug?: string | null;
          source?: string;
          steps?: string[];
          tags?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      shopping_items: {
        Row: {
          category: string;
          created_at: string;
          household_id: string;
          id: string;
          kroger_aisle: string | null;
          kroger_description: string | null;
          kroger_image: string | null;
          kroger_price: number | null;
          kroger_product_id: string | null;
          kroger_size: string | null;
          kroger_upc: string | null;
          manual: boolean;
          match_confidence: string | null;
          name: string;
          order_qty: number;
          order_qty_manual: boolean;
          picked: boolean;
          qty: number | null;
          sent_at: string | null;
          sent_qty: number;
          to_order: boolean;
          unit: string | null;
          week_id: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          household_id: string;
          id?: string;
          kroger_aisle?: string | null;
          kroger_description?: string | null;
          kroger_image?: string | null;
          kroger_price?: number | null;
          kroger_product_id?: string | null;
          kroger_size?: string | null;
          kroger_upc?: string | null;
          manual?: boolean;
          match_confidence?: string | null;
          name: string;
          order_qty?: number;
          order_qty_manual?: boolean;
          picked?: boolean;
          qty?: number | null;
          sent_at?: string | null;
          sent_qty?: number;
          to_order?: boolean;
          unit?: string | null;
          week_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          household_id?: string;
          id?: string;
          kroger_aisle?: string | null;
          kroger_description?: string | null;
          kroger_image?: string | null;
          kroger_price?: number | null;
          kroger_product_id?: string | null;
          kroger_size?: string | null;
          kroger_upc?: string | null;
          manual?: boolean;
          match_confidence?: string | null;
          name?: string;
          order_qty?: number;
          order_qty_manual?: boolean;
          picked?: boolean;
          qty?: number | null;
          sent_at?: string | null;
          sent_qty?: number;
          to_order?: boolean;
          unit?: string | null;
          week_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopping_items_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shopping_items_week_id_fkey";
            columns: ["week_id"];
            isOneToOne: false;
            referencedRelation: "weeks";
            referencedColumns: ["id"];
          },
        ];
      };
      weeks: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          list_built_at: string | null;
          mode: string;
          plan_changed_at: string | null;
          week_start: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          list_built_at?: string | null;
          mode?: string;
          plan_changed_at?: string | null;
          week_start: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          list_built_at?: string | null;
          mode?: string;
          plan_changed_at?: string | null;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weeks_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_household: {
        Args: { p_display_name: string; p_keto: boolean; p_name: string };
        Returns: string;
      };
      is_member: { Args: { hid: string }; Returns: boolean };
      join_household: {
        Args: { p_code: string; p_display_name: string; p_keto: boolean };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

/** The row type for a table, e.g. `Row<"recipes">`. */
export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
