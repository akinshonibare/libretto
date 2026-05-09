// Hand-written Supabase type definitions. Kept in-tree because
// `supabase gen types typescript --linked` requires a local Docker daemon
// (the CLI runs the schema diff in a container), and we deploy from machines
// without Docker. To regenerate against the live DB once Docker is available:
//   pnpm db:types
// The output replaces this file. Until then, every migration adds its tables
// here by hand — keeps tsc honest without bringing Docker into the build path.

export type ReadingStatus = "reading" | "finished" | "dnf";
export type ReadingMode = "absorb" | "study" | "challenge" | "apply" | "enjoy";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          theme: { palette: string; mode: string; type: string } | null;
          created_at: string;
        };
        Insert: {
          id: string;
          handle: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          theme?: { palette: string; mode: string; type: string } | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      books: {
        Row: {
          id: string;
          openlibrary_id: string | null;
          isbn: string | null;
          title: string;
          author: string | null;
          cover_url: string | null;
          year: number | null;
          synopsis: string | null;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          openlibrary_id?: string | null;
          isbn?: string | null;
          title: string;
          author?: string | null;
          cover_url?: string | null;
          year?: number | null;
          synopsis?: string | null;
          slug: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["books"]["Insert"]>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          status: ReadingStatus;
          rating: number | null;
          liked: boolean | null;
          why: string | null;
          synopsis: string | null;
          reading_mode: ReadingMode;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          status?: ReadingStatus;
          rating?: number | null;
          liked?: boolean | null;
          why?: string | null;
          synopsis?: string | null;
          reading_mode?: ReadingMode;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
        Relationships: [];
      };
      chapter_notes: {
        Row: {
          id: string;
          review_id: string;
          label: string | null;
          body: string;
          page: number | null;
          session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          label?: string | null;
          body: string;
          page?: number | null;
          session_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chapter_notes"]["Insert"]>;
        Relationships: [];
      };
      highlights: {
        Row: {
          id: string;
          review_id: string;
          body: string;
          page: number | null;
          source: string;
          position: number | null;
          session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          body: string;
          page?: number | null;
          source?: string;
          position?: number | null;
          session_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["highlights"]["Insert"]>;
        Relationships: [];
      };
      reading_sessions: {
        Row: {
          id: string;
          review_id: string;
          user_id: string;
          mode: ReadingMode;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
        };
        Insert: {
          id?: string;
          review_id: string;
          user_id: string;
          mode?: ReadingMode;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["reading_sessions"]["Insert"]>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          review_id: string;
          user_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          mode: ReadingMode | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          user_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          mode?: ReadingMode | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };
      review_share_tokens: {
        Row: {
          token: string;
          review_id: string;
          created_by: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          token: string;
          review_id: string;
          created_by: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["review_share_tokens"]["Insert"]>;
        Relationships: [];
      };
      streaks: {
        Row: {
          user_id: string;
          current: number;
          longest: number;
          last_logged_date: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          current?: number;
          longest?: number;
          last_logged_date?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["streaks"]["Insert"]>;
        Relationships: [];
      };
      badges: {
        Row: {
          id: string;
          name: string;
          description: string;
          icon: string;
          threshold: number | null;
          metric: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description: string;
          icon?: string;
          threshold?: number | null;
          metric: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["badges"]["Insert"]>;
        Relationships: [];
      };
      user_badges: {
        Row: {
          user_id: string;
          badge_id: string;
          awarded_at: string;
        };
        Insert: {
          user_id: string;
          badge_id: string;
          awarded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_badges"]["Insert"]>;
        Relationships: [];
      };
      library_heart: {
        Row: {
          user_id: string;
          score: number;
          components: Record<string, number> | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          score?: number;
          components?: Record<string, number> | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["library_heart"]["Insert"]>;
        Relationships: [];
      };
      follows: {
        Row: { follower_id: string; followee_id: string; created_at: string };
        Insert: { follower_id: string; followee_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["follows"]["Insert"]>;
        Relationships: [];
      };
      reactions: {
        Row: {
          id: string;
          user_id: string;
          target_type: "review" | "highlight";
          target_id: string;
          kind: "star" | "this_hit" | "bookmark";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: "review" | "highlight";
          target_id: string;
          kind: "star" | "this_hit" | "bookmark";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reactions"]["Insert"]>;
        Relationships: [];
      };
      clubs: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          owner_id: string;
          is_private: boolean;
          current_book_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          owner_id: string;
          is_private?: boolean;
          current_book_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clubs"]["Insert"]>;
        Relationships: [];
      };
      club_members: {
        Row: { club_id: string; user_id: string; role: "owner" | "member"; joined_at: string };
        Insert: { club_id: string; user_id: string; role?: "owner" | "member"; joined_at?: string };
        Update: Partial<Database["public"]["Tables"]["club_members"]["Insert"]>;
        Relationships: [];
      };
      club_messages: {
        Row: { id: string; club_id: string; user_id: string; body: string; created_at: string };
        Insert: { id?: string; club_id: string; user_id: string; body: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["club_messages"]["Insert"]>;
        Relationships: [];
      };
      club_invite_tokens: {
        Row: {
          token: string;
          club_id: string;
          created_by: string;
          created_at: string;
          revoked_at: string | null;
        };
        Insert: {
          token: string;
          club_id: string;
          created_by: string;
          created_at?: string;
          revoked_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["club_invite_tokens"]["Insert"]>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          status: "open" | "closed" | "actioned";
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          status?: "open" | "closed" | "actioned";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [];
      };
      concepts: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          label: string;
          highlight_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          label: string;
          highlight_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["concepts"]["Insert"]>;
        Relationships: [];
      };
      highlight_concepts: {
        Row: { highlight_id: string; concept_id: string };
        Insert: { highlight_id: string; concept_id: string };
        Update: Partial<Database["public"]["Tables"]["highlight_concepts"]["Insert"]>;
        Relationships: [];
      };
      recommendations_cache: {
        Row: {
          user_id: string;
          payload: unknown;
          generated_at: string;
          expires_at: string;
        };
        Insert: {
          user_id: string;
          payload: unknown;
          generated_at?: string;
          expires_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recommendations_cache"]["Insert"]>;
        Relationships: [];
      };
      ai_usage: {
        Row: {
          user_id: string;
          day: string;
          provider: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          estimated_cost_cents: number;
        };
        Insert: {
          user_id: string;
          day?: string;
          provider: string;
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          estimated_cost_cents?: number;
        };
        Update: Partial<Database["public"]["Tables"]["ai_usage"]["Insert"]>;
        Relationships: [];
      };
      resurface_schedule: {
        Row: {
          highlight_id: string;
          user_id: string;
          ease: number;
          interval_days: number;
          lapses: number;
          reviews_count: number;
          last_reviewed_at: string | null;
          next_due_at: string;
        };
        Insert: {
          highlight_id: string;
          user_id: string;
          ease?: number;
          interval_days?: number;
          lapses?: number;
          reviews_count?: number;
          last_reviewed_at?: string | null;
          next_due_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["resurface_schedule"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      review_for_share: {
        Args: { p_review_id: string; p_token?: string | null };
        Returns: Array<{
          id: string;
          user_id: string;
          status: ReadingStatus;
          rating: number | null;
          liked: boolean | null;
          why: string | null;
          synopsis: string | null;
          reading_mode: ReadingMode;
          is_public: boolean;
          updated_at: string;
          book_title: string | null;
          book_author: string | null;
          book_cover_url: string | null;
          book_year: number | null;
          book_slug: string | null;
          author_handle: string | null;
          author_display_name: string | null;
        }>;
      };
      highlights_for_share: {
        Args: { p_review_id: string; p_token?: string | null };
        Returns: Array<{
          id: string;
          review_id: string;
          body: string;
          page: number | null;
          source: string;
          created_at: string;
        }>;
      };
      highlight_for_share: {
        Args: { p_highlight_id: string; p_token?: string | null };
        Returns: Array<{
          id: string;
          body: string;
          page: number | null;
          review_id: string;
          is_public: boolean;
          book_title: string | null;
          book_author: string | null;
          author_handle: string | null;
        }>;
      };
      club_invite_token_valid: {
        Args: { p_club_id: string; p_token: string };
        Returns: boolean;
      };
      club_for_invite: {
        Args: { p_slug: string; p_token?: string | null };
        Returns: Array<{
          id: string;
          slug: string;
          name: string;
          description: string | null;
          owner_id: string;
          is_private: boolean;
          current_book_id: string | null;
          created_at: string;
          book_title: string | null;
          book_author: string | null;
          book_cover_url: string | null;
          book_slug: string | null;
        }>;
      };
      club_members_for_invite: {
        Args: { p_club_id: string; p_token?: string | null };
        Returns: Array<{
          user_id: string;
          role: "owner" | "member";
          handle: string | null;
          display_name: string | null;
          joined_at: string;
        }>;
      };
      club_messages_for_invite: {
        Args: { p_club_id: string; p_token?: string | null };
        Returns: Array<{
          id: string;
          body: string;
          created_at: string;
          user_id: string;
          handle: string | null;
          display_name: string | null;
        }>;
      };
    };
    Enums: { reading_status: ReadingStatus; reading_mode: ReadingMode };
  };
};
