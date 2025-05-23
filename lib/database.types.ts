export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      article_summaries: {
        Row: {
          article_wp_post_id: number
          created_at: string
          language: string
          summary_text: string | null
          updated_at: string
        }
        Insert: {
          article_wp_post_id: number
          created_at?: string
          language: string
          summary_text?: string | null
          updated_at?: string
        }
        Update: {
          article_wp_post_id?: number
          created_at?: string
          language?: string
          summary_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_article"
            columns: ["article_wp_post_id"]
            isOneToOne: false
            referencedRelation: "e2_articles"
            referencedColumns: ["wp_post_id"]
          },
        ]
      }
      article_translations: {
        Row: {
          article_wp_post_id: number
          created_at: string
          language_code: string
          translated_content_text: string | null
          translated_title: string | null
          updated_at: string
        }
        Insert: {
          article_wp_post_id: number
          created_at?: string
          language_code: string
          translated_content_text?: string | null
          translated_title?: string | null
          updated_at?: string
        }
        Update: {
          article_wp_post_id?: number
          created_at?: string
          language_code?: string
          translated_content_text?: string | null
          translated_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_article"
            columns: ["article_wp_post_id"]
            isOneToOne: false
            referencedRelation: "e2_articles"
            referencedColumns: ["wp_post_id"]
          },
        ]
      }
      custom_languages: {
        Row: {
          created_at: string
          language_name: string
        }
        Insert: {
          created_at?: string
          language_name: string
        }
        Update: {
          created_at?: string
          language_name?: string
        }
        Relationships: []
      }
      e2_articles: {
        Row: {
          content_html: string | null
          content_text: string | null
          fetched_at: string | null
          modified_at: string | null
          published_at: string | null
          title: string
          url: string | null
          wp_post_id: number
        }
        Insert: {
          content_html?: string | null
          content_text?: string | null
          fetched_at?: string | null
          modified_at?: string | null
          published_at?: string | null
          title: string
          url?: string | null
          wp_post_id: number
        }
        Update: {
          content_html?: string | null
          content_text?: string | null
          fetched_at?: string | null
          modified_at?: string | null
          published_at?: string | null
          title?: string
          url?: string | null
          wp_post_id?: number
        }
        Relationships: []
      }
      Earthie_scripts: {
        Row: {
          author: string | null
          code: string | null
          copies: number
          created_at: string
          description: string | null
          downloads: number
          file_url: string | null
          id: string
          likes: number
          support_url: string | null
          title: string
        }
        Insert: {
          author?: string | null
          code?: string | null
          copies?: number
          created_at?: string
          description?: string | null
          downloads?: number
          file_url?: string | null
          id?: string
          likes?: number
          support_url?: string | null
          title: string
        }
        Update: {
          author?: string | null
          code?: string | null
          copies?: number
          created_at?: string
          description?: string | null
          downloads?: number
          file_url?: string | null
          id?: string
          likes?: number
          support_url?: string | null
          title?: string
        }
        Relationships: []
      }
      essence_hourly_prices: {
        Row: {
          price: number
          timestamp: string
        }
        Insert: {
          price: number
          timestamp: string
        }
        Update: {
          price?: number
          timestamp?: string
        }
        Relationships: []
      }
      essence_price_history: {
        Row: {
          created_at: string | null
          date: string
          id: number
          price: number
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: number
          price: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: number
          price?: number
        }
        Relationships: []
      }
      lobbyist_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          post_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lobbyist_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lobbyist_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobbyist_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lobbyist_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      lobbyist_echoes: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          original_post_id: string | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          original_post_id?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          original_post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lobbyist_echoes_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "lobbyist_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      lobbyist_followers: {
        Row: {
          created_at: string | null
          followed_id: string | null
          follower_id: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          followed_id?: string | null
          follower_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          followed_id?: string | null
          follower_id?: string | null
          id?: string
        }
        Relationships: []
      }
      lobbyist_posts: {
        Row: {
          content: string | null
          created_at: string | null
          followers_only: boolean | null
          id: string
          image_url: string | null
          is_private: boolean | null
          post_type: string
          sub_lobby: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          followers_only?: boolean | null
          id?: string
          image_url?: string | null
          is_private?: boolean | null
          post_type?: string
          sub_lobby?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          followers_only?: boolean | null
          id?: string
          image_url?: string | null
          is_private?: boolean | null
          post_type?: string
          sub_lobby?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      lobbyist_reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          reaction_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          reaction_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          reaction_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lobbyist_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lobbyist_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      lobbyist_sub_lobbies: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      socials: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "socials_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "socials_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_e2_profiles: {
        Row: {
          created_at: string
          e2_user_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          e2_user_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          e2_user_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_tracked_properties: {
        Row: {
          country: string | null
          created_at: string
          current_value: string | null
          description: string | null
          epl: string | null
          essence_balance: string | null
          has_holobuilding: boolean | null
          has_mentar: boolean | null
          id: string
          is_for_sale: boolean | null
          landfield_tier: number | null
          last_synced_at: string | null
          location: string | null
          marketplace_price: string | null
          property_id: string
          purchase_value: string | null
          thumbnail_url: string | null
          tile_class: string | null
          tile_count: number | null
          trading_value: string | null
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          current_value?: string | null
          description?: string | null
          epl?: string | null
          essence_balance?: string | null
          has_holobuilding?: boolean | null
          has_mentar?: boolean | null
          id?: string
          is_for_sale?: boolean | null
          landfield_tier?: number | null
          last_synced_at?: string | null
          location?: string | null
          marketplace_price?: string | null
          property_id: string
          purchase_value?: string | null
          thumbnail_url?: string | null
          tile_class?: string | null
          tile_count?: number | null
          trading_value?: string | null
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          current_value?: string | null
          description?: string | null
          epl?: string | null
          essence_balance?: string | null
          has_holobuilding?: boolean | null
          has_mentar?: boolean | null
          id?: string
          is_for_sale?: boolean | null
          landfield_tier?: number | null
          last_synced_at?: string | null
          location?: string | null
          marketplace_price?: string | null
          property_id?: string
          purchase_value?: string | null
          thumbnail_url?: string | null
          tile_class?: string | null
          tile_count?: number | null
          trading_value?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_likes: {
        Args: { script_id_input: string }
        Returns: undefined
      }
      get_follower_count: {
        Args: { user_id: string }
        Returns: number
      }
      get_following_count: {
        Args: { user_id: string }
        Returns: number
      }
      increment_copies: {
        Args: { script_id_input: string }
        Returns: undefined
      }
      increment_downloads: {
        Args: { script_id_input: string }
        Returns: undefined
      }
      increment_likes: {
        Args: { script_id_input: string }
        Returns: undefined
      }
      is_following: {
        Args: { follower: string; following: string }
        Returns: boolean
      }
    }
    Enums: {
      relationship_type: "follow" | "block" | "mute"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      relationship_type: ["follow", "block", "mute"],
    },
  },
} as const
