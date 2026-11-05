
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "brief_versions": {
                  Row: {
                    "brief_id": string,"created_at": string,"id": number,"output": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "brief_id": string,"created_at"?: string,"id"?: number,"output": NonNullable<Json>
                  }
                  Update: {
                    "brief_id"?: string,"created_at"?: string,"id"?: number,"output"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "brief_versions_brief_id_fkey"
      columns: ["brief_id"]
isOneToOne: false
      referencedRelation: "briefs"
      referencedColumns: ["id"]
    }
                  ]
                },"briefs": {
                  Row: {
                    "audience": string | null,"created_at": string,"edited": Json | null,"error": string | null,"format": string,"id": string,"length": string | null,"model": string | null,"niche_id": string | null,"output": Json | null,"platform": string,"published_at": string | null,"published_url": string | null,"selected_hook": number | null,"status": Database["public"]['Enums']["brief_status"],"story_id": string,"tokens_in": number | null,"tokens_out": number | null,"tone": string,"updated_at": string,"user_id": string,"user_take": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string | null,"created_at"?: string,"edited"?: Json | null,"error"?: string | null,"format": string,"id"?: string,"length"?: string | null,"model"?: string | null,"niche_id"?: string | null,"output"?: Json | null,"platform": string,"published_at"?: string | null,"published_url"?: string | null,"selected_hook"?: number | null,"status"?: Database["public"]['Enums']["brief_status"],"story_id": string,"tokens_in"?: number | null,"tokens_out"?: number | null,"tone": string,"updated_at"?: string,"user_id": string,"user_take"?: string | null
                  }
                  Update: {
                    "audience"?: string | null,"created_at"?: string,"edited"?: Json | null,"error"?: string | null,"format"?: string,"id"?: string,"length"?: string | null,"model"?: string | null,"niche_id"?: string | null,"output"?: Json | null,"platform"?: string,"published_at"?: string | null,"published_url"?: string | null,"selected_hook"?: number | null,"status"?: Database["public"]['Enums']["brief_status"],"story_id"?: string,"tokens_in"?: number | null,"tokens_out"?: number | null,"tone"?: string,"updated_at"?: string,"user_id"?: string,"user_take"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "briefs_niche_id_fkey"
      columns: ["niche_id"]
isOneToOne: false
      referencedRelation: "niches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "briefs_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "briefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"email_log": {
                  Row: {
                    "created_at": string,"day": string,"id": number,"kind": string,"opened_at": string | null,"provider_id": string | null,"story_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"id"?: number,"kind": string,"opened_at"?: string | null,"provider_id"?: string | null,"story_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"id"?: number,"kind"?: string,"opened_at"?: string | null,"provider_id"?: string | null,"story_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_log_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_log_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback": {
                  Row: {
                    "created_at": string,"id": number,"message": string,"page": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: number,"message": string,"page"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: number,"message"?: string,"page"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"item_metrics": {
                  Row: {
                    "captured_at": string,"metric": string,"raw_item_id": number,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "captured_at"?: string,"metric": string,"raw_item_id": number,"value": number
                  }
                  Update: {
                    "captured_at"?: string,"metric"?: string,"raw_item_id"?: number,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_metrics_raw_item_id_fkey"
      columns: ["raw_item_id"]
isOneToOne: false
      referencedRelation: "raw_items"
      referencedColumns: ["id"]
    }
                  ]
                },"llm_model_state": {
                  Row: {
                    "model": string,"reason": string,"unavailable_until": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "model": string,"reason": string,"unavailable_until": string,"updated_at"?: string
                  }
                  Update: {
                    "model"?: string,"reason"?: string,"unavailable_until"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"llm_usage": {
                  Row: {
                    "cost_usd": number | null,"created_at": string,"id": number,"job": string,"model": string,"tokens_in": number | null,"tokens_out": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_usd"?: number | null,"created_at"?: string,"id"?: number,"job": string,"model": string,"tokens_in"?: number | null,"tokens_out"?: number | null
                  }
                  Update: {
                    "cost_usd"?: number | null,"created_at"?: string,"id"?: number,"job"?: string,"model"?: string,"tokens_in"?: number | null,"tokens_out"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"niches": {
                  Row: {
                    "alert_threshold": number,"created_at": string,"embedding": string | null,"excluded_keywords": (string)[],"id": string,"keywords": (string)[],"language": string,"name": string,"platforms": (string)[],"tone": string,"tracked_channels": (string)[],"user_id": string,"voice_samples": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_threshold"?: number,"created_at"?: string,"embedding"?: string | null,"excluded_keywords"?: (string)[],"id"?: string,"keywords"?: (string)[],"language"?: string,"name": string,"platforms"?: (string)[],"tone"?: string,"tracked_channels"?: (string)[],"user_id": string,"voice_samples"?: (string)[]
                  }
                  Update: {
                    "alert_threshold"?: number,"created_at"?: string,"embedding"?: string | null,"excluded_keywords"?: (string)[],"id"?: string,"keywords"?: (string)[],"language"?: string,"name"?: string,"platforms"?: (string)[],"tone"?: string,"tracked_channels"?: (string)[],"user_id"?: string,"voice_samples"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "niches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pipeline_runs": {
                  Row: {
                    "error": string | null,"finished_at": string | null,"fn": string,"id": number,"started_at": string,"stats": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"finished_at"?: string | null,"fn": string,"id"?: number,"started_at"?: string,"stats"?: Json | null
                  }
                  Update: {
                    "error"?: string | null,"finished_at"?: string | null,"fn"?: string,"id"?: number,"started_at"?: string,"stats"?: Json | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "alerts_enabled": boolean,"created_at": string,"digest_enabled": boolean,"digest_hour": number,"id": string,"is_admin": boolean,"locale": string,"name": string | null,"onboarded_at": string | null,"signup_captured_at": string | null,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alerts_enabled"?: boolean,"created_at"?: string,"digest_enabled"?: boolean,"digest_hour"?: number,"id": string,"is_admin"?: boolean,"locale"?: string,"name"?: string | null,"onboarded_at"?: string | null,"signup_captured_at"?: string | null,"timezone"?: string
                  }
                  Update: {
                    "alerts_enabled"?: boolean,"created_at"?: string,"digest_enabled"?: boolean,"digest_hour"?: number,"id"?: string,"is_admin"?: boolean,"locale"?: string,"name"?: string | null,"onboarded_at"?: string | null,"signup_captured_at"?: string | null,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"raw_items": {
                  Row: {
                    "author": string | null,"canonical_url": string,"content_hash": string,"content_text": string | null,"description": string | null,"duplicate_of": number | null,"embedding": string | null,"external_id": string,"fetched_at": string,"filter_status": string,"id": number,"language": string | null,"published_at": string | null,"raw_metadata": NonNullable<Json>,"reject_reason": string | null,"simhash": number | null,"source_id": string,"title": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author"?: string | null,"canonical_url": string,"content_hash": string,"content_text"?: string | null,"description"?: string | null,"duplicate_of"?: number | null,"embedding"?: string | null,"external_id": string,"fetched_at"?: string,"filter_status"?: string,"id"?: number,"language"?: string | null,"published_at"?: string | null,"raw_metadata"?: NonNullable<Json>,"reject_reason"?: string | null,"simhash"?: number | null,"source_id": string,"title": string,"url": string
                  }
                  Update: {
                    "author"?: string | null,"canonical_url"?: string,"content_hash"?: string,"content_text"?: string | null,"description"?: string | null,"duplicate_of"?: number | null,"embedding"?: string | null,"external_id"?: string,"fetched_at"?: string,"filter_status"?: string,"id"?: number,"language"?: string | null,"published_at"?: string | null,"raw_metadata"?: NonNullable<Json>,"reject_reason"?: string | null,"simhash"?: number | null,"source_id"?: string,"title"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "raw_items_duplicate_of_fkey"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "raw_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "raw_items_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    }
                  ]
                },"sources": {
                  Row: {
                    "active": boolean,"config": NonNullable<Json>,"consecutive_failures": number,"created_at": string,"etag": string | null,"fetch_interval_min": number,"id": string,"last_error": string | null,"last_fetched_at": string | null,"last_modified": string | null,"name": string,"trust_weight": number,"type": Database["public"]['Enums']["source_type"],"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"config"?: NonNullable<Json>,"consecutive_failures"?: number,"created_at"?: string,"etag"?: string | null,"fetch_interval_min"?: number,"id"?: string,"last_error"?: string | null,"last_fetched_at"?: string | null,"last_modified"?: string | null,"name": string,"trust_weight"?: number,"type": Database["public"]['Enums']["source_type"],"url": string
                  }
                  Update: {
                    "active"?: boolean,"config"?: NonNullable<Json>,"consecutive_failures"?: number,"created_at"?: string,"etag"?: string | null,"fetch_interval_min"?: number,"id"?: string,"last_error"?: string | null,"last_fetched_at"?: string | null,"last_modified"?: string | null,"name"?: string,"trust_weight"?: number,"type"?: Database["public"]['Enums']["source_type"],"url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stories": {
                  Row: {
                    "build_failures": number,"built_source_count": number,"category": Database["public"]['Enums']["story_category"] | null,"creator_relevance": number | null,"engagement_score": number,"entities": NonNullable<Json>,"first_seen_at": string,"freshness_score": number,"global_score": number,"id": string,"is_early_signal": boolean,"last_built_at": string | null,"last_updated_at": string,"search": unknown,"sentiment": string | null,"slug": string | null,"source_count": number,"source_diversity_score": number,"status": Database["public"]['Enums']["story_status"],"suggested_angles": NonNullable<Json>,"summary": string | null,"title": string | null,"trust_score": number,"velocity_score": number,"why_it_matters": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "build_failures"?: number,"built_source_count"?: number,"category"?: Database["public"]['Enums']["story_category"] | null,"creator_relevance"?: number | null,"engagement_score"?: number,"entities"?: NonNullable<Json>,"first_seen_at"?: string,"freshness_score"?: number,"global_score"?: number,"id"?: string,"is_early_signal"?: boolean,"last_built_at"?: string | null,"last_updated_at"?: string,"search"?: never,"sentiment"?: string | null,"slug"?: string | null,"source_count"?: number,"source_diversity_score"?: number,"status"?: Database["public"]['Enums']["story_status"],"suggested_angles"?: NonNullable<Json>,"summary"?: string | null,"title"?: string | null,"trust_score"?: number,"velocity_score"?: number,"why_it_matters"?: string | null
                  }
                  Update: {
                    "build_failures"?: number,"built_source_count"?: number,"category"?: Database["public"]['Enums']["story_category"] | null,"creator_relevance"?: number | null,"engagement_score"?: number,"entities"?: NonNullable<Json>,"first_seen_at"?: string,"freshness_score"?: number,"global_score"?: number,"id"?: string,"is_early_signal"?: boolean,"last_built_at"?: string | null,"last_updated_at"?: string,"search"?: never,"sentiment"?: string | null,"slug"?: string | null,"source_count"?: number,"source_diversity_score"?: number,"status"?: Database["public"]['Enums']["story_status"],"suggested_angles"?: NonNullable<Json>,"summary"?: string | null,"title"?: string | null,"trust_score"?: number,"velocity_score"?: number,"why_it_matters"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"story_clusters": {
                  Row: {
                    "created_at": string,"embedding": string,"item_count": number,"similarity_threshold": number,"story_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"embedding": string,"item_count"?: number,"similarity_threshold"?: number,"story_id": string
                  }
                  Update: {
                    "created_at"?: string,"embedding"?: string,"item_count"?: number,"similarity_threshold"?: number,"story_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_clusters_story_id_fkey"
      columns: ["story_id"]
isOneToOne: true
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"story_sources": {
                  Row: {
                    "id": number,"raw_item_id": number,"source_id": string,"story_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number,"raw_item_id": number,"source_id": string,"story_id": string
                  }
                  Update: {
                    "id"?: number,"raw_item_id"?: number,"source_id"?: string,"story_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_sources_raw_item_id_fkey"
      columns: ["raw_item_id"]
isOneToOne: true
      referencedRelation: "raw_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_sources_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_sources_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"trend_scores": {
                  Row: {
                    "calculated_at": string,"id": number,"metric": string,"story_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "calculated_at"?: string,"id"?: number,"metric": string,"story_id": string,"value": number
                  }
                  Update: {
                    "calculated_at"?: string,"id"?: number,"metric"?: string,"story_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "trend_scores_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_counters": {
                  Row: {
                    "count": number,"day": string,"kind": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"day": string,"kind": string,"user_id": string
                  }
                  Update: {
                    "count"?: number,"day"?: string,"kind"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_counters_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_signals": {
                  Row: {
                    "action": Database["public"]['Enums']["signal_action"],"created_at": string,"id": number,"story_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["signal_action"],"created_at"?: string,"id"?: number,"story_id": string,"user_id": string
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["signal_action"],"created_at"?: string,"id"?: number,"story_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_signals_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_signals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_story_angles": {
                  Row: {
                    "angle": string,"created_at": string,"niche_id": string,"story_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "angle": string,"created_at"?: string,"niche_id": string,"story_id": string,"user_id": string
                  }
                  Update: {
                    "angle"?: string,"created_at"?: string,"niche_id"?: string,"story_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_story_angles_niche_id_fkey"
      columns: ["niche_id"]
isOneToOne: false
      referencedRelation: "niches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_story_angles_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_story_angles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_llm_spend":
{ Args: { "p_days": number,"p_now": string }; Returns: {
              "calls": number,"cost_usd": number,"day": string
            }[]
                           },
"admin_reject_reasons":
{ Args: { "p_since": string }; Returns: {
              "count": number,"reason": string
            }[]
                           },
"apply_story_scores":
{ Args: { "p_scores": Json }; Returns: number
                           },
"archive_stale_stories":
{ Args: { "p_cutoff": string }; Returns: number
                           },
"attach_duplicates":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"cluster_item":
{ Args: { "p_embedding": string,"p_item_id": number,"p_since": string,"p_threshold": number }; Returns: {
              "created": boolean,"story_id": string
            }[]
                           },
"digest_due_users":
{ Args: { "p_now": string }; Returns: {
              "email": string,"local_day": string,"locale": string,"timezone": string,"user_id": string
            }[]
                           },
"discover_story_signals":
{ Args: { "p_story_ids": (string)[] }; Returns: {
              "github_stars": number,"hn_comments": number,"hn_points": number,"producthunt_votes": number,"reddit_upvotes": number,"story_id": string
            }[]
                           },
"discover_story_sources":
{ Args: { "p_story_id": string }; Returns: {
              "published_at": string,"raw_item_id": number,"source_name": string,"source_type": Database["public"]['Enums']["source_type"],"title": string,"url": string
            }[]
                           },
"due_sources":
{ Args: Record<PropertyKey, never>; Returns: {
              "active": boolean,
"config": NonNullable<Json>,
"consecutive_failures": number,
"created_at": string,
"etag": string | null,
"fetch_interval_min": number,
"id": string,
"last_error": string | null,
"last_fetched_at": string | null,
"last_modified": string | null,
"name": string,
"trust_weight": number,
"type": Database["public"]['Enums']["source_type"],
"url": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "sources"
        isOneToOne: false
        isSetofReturn: true
      } },
"find_duplicate":
{ Args: { "p_item_id": number,"p_max_distance": number,"p_since": string }; Returns: {
              "duplicate_of": number,"kind": string
            }[]
                           },
"increment_usage":
{ Args: { "p_kind": string,"p_limit": number,"p_user": string }; Returns: boolean
                           },
"ingest_raw_items":
{ Args: { "p_items": Json,"p_source_id": string }; Returns: {
              "external_id": string,"id": number,"inserted": boolean
            }[]
                           },
"match_story_cluster":
{ Args: { "p_embedding": string,"p_since": string,"p_threshold": number }; Returns: {
              "similarity": number,"story_id": string
            }[]
                           },
"prune_trend_scores":
{ Args: { "p_before": string }; Returns: number
                           },
"radar_feed":
{ Args: { "p_niche": string,"p_user": string }; Returns: {
              "bucket": string,"category": Database["public"]['Enums']["story_category"],"engagement_score": number,"final_score": number,"first_seen_at": string,"global_score": number,"is_early_signal": boolean,"niche_fit": number,"saved": boolean,"slug": string,"source_count": number,"story_id": string,"summary": string,"title": string,"trust_score": number,"velocity_score": number,"why_it_matters": string
            }[]
                           },
"release_usage":
{ Args: { "p_kind": string,"p_user": string }; Returns: undefined
                           },
"story_metric_window":
{ Args: { "p_since": string,"p_window_start": string }; Returns: {
              "baseline": number,"latest": number,"metric": string,"raw_item_id": number,"source_type": Database["public"]['Enums']["source_type"],"story_id": string
            }[]
                           },
"url_host":
{ Args: { "p_url": string }; Returns: string
                           },
"word_pattern":
{ Args: { "p_term": string }; Returns: string
                           }
          }
          Enums: {
            "brief_status": "queued"|"generating"|"ready"|"failed","signal_action": "save"|"hide"|"boost"|"generate"|"published","source_type": "rss"|"hn"|"reddit"|"github"|"producthunt"|"arxiv"|"youtube","story_category": "ai_models"|"ai_tools"|"developer_tools"|"open_source"|"startups"|"security"|"web_frontend"|"mobile"|"data_infra"|"other","story_status": "pending"|"published"|"archived"|"suppressed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "brief_status": ["queued", "generating", "ready", "failed"],"signal_action": ["save", "hide", "boost", "generate", "published"],"source_type": ["rss", "hn", "reddit", "github", "producthunt", "arxiv", "youtube"],"story_category": ["ai_models", "ai_tools", "developer_tools", "open_source", "startups", "security", "web_frontend", "mobile", "data_infra", "other"],"story_status": ["pending", "published", "archived", "suppressed"]
          }
        }
} as const
