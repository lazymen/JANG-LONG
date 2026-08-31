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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      checkout_shipping_settings: {
        Row: {
          base_shipping_fee: number
          created_at: string
          free_shipping_threshold: number
          id: number
          is_provisional: boolean
          remote_area_surcharge: number
          updated_at: string
        }
        Insert: {
          base_shipping_fee: number
          created_at?: string
          free_shipping_threshold: number
          id?: number
          is_provisional?: boolean
          remote_area_surcharge: number
          updated_at?: string
        }
        Update: {
          base_shipping_fee?: number
          created_at?: string
          free_shipping_threshold?: number
          id?: number
          is_provisional?: boolean
          remote_area_surcharge?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_path: string
          order_id: string
          product_id: string
          product_name: string
          size: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          order_id: string
          product_id: string
          product_name: string
          size?: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          order_id?: string
          product_id?: string
          product_name?: string
          size?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_line1: string
          address_line2: string
          cancelled_at: string | null
          carrier: string | null
          checkout_key_hash: string
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_note: string
          expired_at: string | null
          id: string
          is_remote_area: boolean
          order_number: string
          paid_at: string | null
          postal_code: string
          recovery_token_hash: string
          refunded_at: string | null
          reservation_expires_at: string
          reservation_started_at: string
          shipped_at: string | null
          shipping_fee: number
          shipping_status: string
          status: string
          subtotal: number
          total_amount: number | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          address_line1: string
          address_line2?: string
          cancelled_at?: string | null
          carrier?: string | null
          checkout_key_hash: string
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_note?: string
          expired_at?: string | null
          id?: string
          is_remote_area?: boolean
          order_number: string
          paid_at?: string | null
          postal_code: string
          recovery_token_hash: string
          refunded_at?: string | null
          reservation_expires_at: string
          reservation_started_at?: string
          shipped_at?: string | null
          shipping_fee?: number
          shipping_status?: string
          status?: string
          subtotal: number
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string
          cancelled_at?: string | null
          carrier?: string | null
          checkout_key_hash?: string
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_note?: string
          expired_at?: string | null
          id?: string
          is_remote_area?: boolean
          order_number?: string
          paid_at?: string | null
          postal_code?: string
          recovery_token_hash?: string
          refunded_at?: string | null
          reservation_expires_at?: string
          reservation_started_at?: string
          shipped_at?: string | null
          shipping_fee?: number
          shipping_status?: string
          status?: string
          subtotal?: number
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          amount: number
          attempt_number: number
          created_at: string
          failure_code: string | null
          failure_message: string | null
          id: string
          order_id: string
          provider: string
          provider_payment_id: string | null
          request_key_hash: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          attempt_number: number
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          order_id: string
          provider?: string
          provider_payment_id?: string | null
          request_key_hash: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attempt_number?: number
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          order_id?: string
          provider?: string
          provider_payment_id?: string | null
          request_key_hash?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          country: string
          created_at: string
          description: string
          era: string
          id: string
          images: string[]
          is_published: boolean
          measurement: Json
          name: string
          notes: string
          price: number
          published_at: string | null
          reserved_order_id: string | null
          size: string
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          category: string
          country?: string
          created_at?: string
          description?: string
          era?: string
          id: string
          images: string[]
          is_published?: boolean
          measurement?: Json
          name: string
          notes?: string
          price: number
          published_at?: string | null
          reserved_order_id?: string | null
          size?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          category?: string
          country?: string
          created_at?: string
          description?: string
          era?: string
          id?: string
          images?: string[]
          is_published?: boolean
          measurement?: Json
          name?: string
          notes?: string
          price?: number
          published_at?: string | null
          reserved_order_id?: string | null
          size?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_reserved_order_id_fkey"
            columns: ["reserved_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_checkout_shipping_fee: {
        Args: { p_is_remote_area: boolean; p_subtotal: number }
        Returns: number
      }
      cancel_guest_checkout: {
        Args: { p_checkout_key_hash: string; p_recovery_token_hash: string }
        Returns: {
          order_id: string
          order_number: string
          order_status: string
          released_product_count: number
        }[]
      }
      cleanup_order_lookup_rate_limits: {
        Args: { p_retention_days?: number }
        Returns: number
      }
      consume_order_lookup_rate_limit: {
        Args: {
          p_limit?: number
          p_rate_key: string
          p_window_seconds?: number
        }
        Returns: {
          is_allowed: boolean
          retry_after_seconds: number
        }[]
      }
      expire_guest_checkouts: {
        Args: { p_batch_size?: number }
        Returns: {
          expired_order_count: number
          released_product_count: number
        }[]
      }
      resume_guest_checkout: {
        Args: { p_checkout_key_hash: string; p_recovery_token_hash: string }
        Returns: {
          order_id: string
          order_items: Json
          order_number: string
          order_status: string
          reservation_expires_at: string
          shipping_fee: number
          subtotal: number
          total_amount: number
        }[]
      }
      start_guest_checkout: {
        Args: {
          p_address_line1: string
          p_address_line2: string
          p_checkout_key_hash: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_delivery_note: string
          p_is_remote_area: boolean
          p_postal_code: string
          p_product_ids: string[]
          p_recovery_token_hash: string
        }
        Returns: {
          order_id: string
          order_number: string
          order_status: string
          reservation_expires_at: string
          reservation_started_at: string
          shipping_fee: number
          subtotal: number
          total_amount: number
          was_created: boolean
        }[]
      }
    }
    Enums: {
      product_status: "available" | "reserved" | "gone"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      product_status: ["available", "reserved", "gone"],
    },
  },
} as const
