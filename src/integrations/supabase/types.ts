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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_account_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_account_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_activity: {
        Row: {
          created_at: string
          detail: Json
          hidden: boolean
          id: string
          kind: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          hidden?: boolean
          id?: string
          kind: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          detail?: Json
          hidden?: boolean
          id?: string
          kind?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_chat_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by_role: string | null
          edited_at: string | null
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_role?: string | null
          edited_at?: string | null
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_role?: string | null
          edited_at?: string | null
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "app_chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_chat_rooms: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_public: boolean
          name: string
          read_only: boolean
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean
          name: string
          read_only?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean
          name?: string
          read_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "app_chat_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_extras: {
        Row: {
          chat_rank: string | null
          kleb_body: string
          kleb_enabled: boolean
          kleb_layout: string
          kleb_title: string
          user_id: string
        }
        Insert: {
          chat_rank?: string | null
          kleb_body?: string
          kleb_enabled?: boolean
          kleb_layout?: string
          kleb_title?: string
          user_id: string
        }
        Update: {
          chat_rank?: string | null
          kleb_body?: string
          kleb_enabled?: boolean
          kleb_layout?: string
          kleb_title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_extras_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          kind: string
          title: string
        }
        Insert: {
          author_id: string
          body?: string
          created_at?: string
          id?: string
          kind: string
          title: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_room_members: {
        Row: {
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "app_chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_room_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_uploads: {
        Row: {
          chunk_count: number
          complete: boolean
          created_at: string
          id: string
          kind: string
          message_id: string | null
          mime: string
          name: string
          room_id: string | null
          size_bytes: number
          user_id: string
        }
        Insert: {
          chunk_count: number
          complete?: boolean
          created_at?: string
          id?: string
          kind: string
          message_id?: string | null
          mime: string
          name: string
          room_id?: string | null
          size_bytes: number
          user_id: string
        }
        Update: {
          chunk_count?: number
          complete?: boolean
          created_at?: string
          id?: string
          kind?: string
          message_id?: string | null
          mime?: string
          name?: string
          room_id?: string | null
          size_bytes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_uploads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "app_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_uploads_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "app_chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_users: {
        Row: {
          avatar: string | null
          banned: boolean
          bio: string
          blocked_tabs: string[]
          created_at: string
          id: string
          is_admin: boolean
          last_seen: string
          password: string
          pin_hash: string | null
          settings: Json
          username: string
        }
        Insert: {
          avatar?: string | null
          banned?: boolean
          bio?: string
          blocked_tabs?: string[]
          created_at?: string
          id?: string
          is_admin?: boolean
          last_seen?: string
          password: string
          pin_hash?: string | null
          settings?: Json
          username: string
        }
        Update: {
          avatar?: string | null
          banned?: boolean
          bio?: string
          blocked_tabs?: string[]
          created_at?: string
          id?: string
          is_admin?: boolean
          last_seen?: string
          password?: string
          pin_hash?: string | null
          settings?: Json
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reserve_radium_upload: {
        Args: {
          p_chunks: number
          p_id: string
          p_kind: string
          p_mime: string
          p_name: string
          p_room: string
          p_size: number
          p_user: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
