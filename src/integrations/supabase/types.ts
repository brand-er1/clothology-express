export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      funding_participations: {
        Row: {
          created_at: string
          funding_id: string
          id: string
          participant_id: string
          quantity: number
          selected_color: string
          selected_size: string
          status: string
          total_amount: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          funding_id: string
          id?: string
          participant_id: string
          quantity: number
          selected_color: string
          selected_size: string
          status?: string
          total_amount?: number | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          funding_id?: string
          id?: string
          participant_id?: string
          quantity?: number
          selected_color?: string
          selected_size?: string
          status?: string
          total_amount?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_participations_funding_id_fkey"
            columns: ["funding_id"]
            isOneToOne: false
            referencedRelation: "fundings"
            referencedColumns: ["id"]
          },
        ]
      }
      fundings: {
        Row: {
          admin_comment: string | null
          cloth_type: string
          color: string | null
          color_options: string[]
          created_at: string
          creator_id: string
          current_orders: number
          description: string | null
          funding_days: number
          id: string
          image_path: string | null
          image_url: string
          material: string
          measurements: Json | null
          moq: number
          price: number | null
          product_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          size: string
          size_options: string[]
          status: string
          updated_at: string
        }
        Insert: {
          admin_comment?: string | null
          cloth_type: string
          color?: string | null
          color_options?: string[]
          created_at?: string
          creator_id: string
          current_orders?: number
          description?: string | null
          funding_days?: number
          id?: string
          image_path?: string | null
          image_url: string
          material: string
          measurements?: Json | null
          moq?: number
          price?: number | null
          product_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          size: string
          size_options?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          admin_comment?: string | null
          cloth_type?: string
          color?: string | null
          color_options?: string[]
          created_at?: string
          creator_id?: string
          current_orders?: number
          description?: string | null
          funding_days?: number
          id?: string
          image_path?: string | null
          image_url?: string
          material?: string
          measurements?: Json | null
          moq?: number
          price?: number | null
          product_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          size?: string
          size_options?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      generated_images: {
        Row: {
          cloth_type: string | null
          created_at: string
          detail: string | null
          generation_prompt: string | null
          id: string
          image_path: string | null
          is_selected: boolean | null
          material: string | null
          original_image_url: string | null
          prompt: string
          stored_image_url: string | null
          user_id: string
        }
        Insert: {
          cloth_type?: string | null
          created_at?: string
          detail?: string | null
          generation_prompt?: string | null
          id?: string
          image_path?: string | null
          is_selected?: boolean | null
          material?: string | null
          original_image_url?: string | null
          prompt: string
          stored_image_url?: string | null
          user_id: string
        }
        Update: {
          cloth_type?: string | null
          created_at?: string
          detail?: string | null
          generation_prompt?: string | null
          id?: string
          image_path?: string | null
          is_selected?: boolean | null
          material?: string | null
          original_image_url?: string | null
          prompt?: string
          stored_image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_comment: string | null
          cloth_type: string
          created_at: string
          detail_description: string | null
          generated_image_url: string | null
          id: string
          image_path: string | null
          material: string
          measurements: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          size: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_comment?: string | null
          cloth_type: string
          created_at?: string
          detail_description?: string | null
          generated_image_url?: string | null
          id?: string
          image_path?: string | null
          material: string
          measurements?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_comment?: string | null
          cloth_type?: string
          created_at?: string
          detail_description?: string | null
          generated_image_url?: string | null
          id?: string
          image_path?: string | null
          material?: string
          measurements?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          full_name: string | null
          gender: string
          height: number | null
          id: string
          phone_number: string | null
          updated_at: string
          username: string | null
          weight: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string
          height?: number | null
          id: string
          phone_number?: string | null
          updated_at?: string
          username?: string | null
          weight?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string
          height?: number | null
          id?: string
          phone_number?: string | null
          updated_at?: string
          username?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          created_at: string | null
          id: string
          prompt: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          prompt: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          prompt?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_funding_participants: {
        Args: { p_funding_id: string }
        Returns: {
          created_at: string
          id: string
          participant_id: string
          participant_name: string
          phone_number: string
          quantity: number
          selected_color: string
          selected_size: string
          status: string
          total_amount: number
          unit_price: number
        }[]
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      participate_in_funding: {
        Args: {
          p_color: string
          p_funding_id: string
          p_quantity: number
          p_size: string
        }
        Returns: string
      }
      update_funding_participation_status: {
        Args: { p_participation_id: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      order_status: "pending" | "approved" | "rejected" | "deleted"
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_status: ["pending", "approved", "rejected", "deleted"],
      user_role: ["admin", "user"],
    },
  },
} as const
