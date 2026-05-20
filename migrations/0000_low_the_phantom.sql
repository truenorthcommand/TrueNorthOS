CREATE TABLE "accounts_receipts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" varchar,
	"uploaded_by_id" varchar NOT NULL,
	"image_url" text NOT NULL,
	"ocr_vendor" text,
	"ocr_amount" double precision,
	"ocr_date" timestamp,
	"ocr_category" text,
	"ocr_raw_data" jsonb,
	"is_processed" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by_id" varchar,
	"verified_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "add_ons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"monthly_price" double precision NOT NULL,
	"icon" text,
	"category" text DEFAULT 'feature',
	"features" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_advisors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'Bot' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"system_prompt" text NOT NULL,
	"gpt_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_business_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_type" text NOT NULL,
	"category" text,
	"data" jsonb NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"last_occurrence" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_cache" (
	"key" varchar PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"org_id" varchar,
	"updated_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"version" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text DEFAULT 'New Conversation' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"endpoint" text NOT NULL,
	"prompt_version" text,
	"input_refs_json" jsonb DEFAULT '{}'::jsonb,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"output_json" jsonb DEFAULT '{}'::jsonb,
	"confidence" double precision,
	"sources_used" jsonb DEFAULT '[]'::jsonb,
	"approval_status" text DEFAULT 'pending',
	"approved_by_id" varchar,
	"approved_at" timestamp,
	"requested_by_id" varchar,
	"duration_ms" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_user_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"communication_style" text DEFAULT 'professional',
	"preferred_actions" jsonb DEFAULT '[]'::jsonb,
	"shortcuts" jsonb DEFAULT '[]'::jsonb,
	"dashboard_preferences" jsonb DEFAULT '{}'::jsonb,
	"notification_preferences" jsonb DEFAULT '{}'::jsonb,
	"last_learned_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "asset_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" varchar NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"performed_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"serial_number" text,
	"barcode" text,
	"manufacturer" text,
	"model" text,
	"description" text,
	"category_type" text DEFAULT 'equipment',
	"condition" text DEFAULT 'good',
	"location" text,
	"purchase_date" timestamp,
	"purchase_price" double precision,
	"warranty_expiry" timestamp,
	"warranty_notes" text,
	"warranty_provider" text,
	"assigned_job_id" varchar,
	"assigned_client_id" varchar,
	"assigned_user_id" varchar,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"last_service_date" timestamp,
	"next_service_due" timestamp,
	"product_url" text,
	"manual_url" text,
	"qr_code_data" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"accessed_by_user_id" varchar NOT NULL,
	"accessed_by_user_name" text,
	"access_type" text,
	"filters_applied" jsonb,
	"records_accessed" integer,
	"export_format" text
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"page_route" text,
	"ip_address" text,
	"user_agent" text,
	"session_id" text,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"user_email" text,
	"user_role" text NOT NULL,
	"action_type" text NOT NULL,
	"action_category" text,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"action_description" text,
	"changes_json" jsonb,
	"metadata_json" jsonb,
	"severity" text DEFAULT 'info',
	"is_sensitive" boolean DEFAULT false,
	"requires_review" boolean DEFAULT false,
	"previous_log_id" varchar,
	"checksum" text
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"category" text DEFAULT 'Operations' NOT NULL,
	"excerpt" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"author" text NOT NULL,
	"cover_image" text,
	"read_time" text DEFAULT '5 min read' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"thread_id" text NOT NULL,
	"title" text DEFAULT 'New conversation',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "check_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_id" varchar NOT NULL,
	"item_name" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"photo_url" text,
	"severity" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"role" text,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"postcode" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"notes" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"postcode" text,
	"contact_name" text,
	"notes" text,
	"portal_token" text,
	"portal_enabled" boolean DEFAULT false,
	"portal_password" text,
	"portal_password_set_at" timestamp,
	"password_reset_token" text,
	"password_reset_expires" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"updated_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text,
	"company_address" text,
	"company_phone" text,
	"company_email" text,
	"bank_name" text,
	"bank_account_name" text,
	"bank_sort_code" text,
	"bank_account_number" text,
	"vat_number" text,
	"default_vat_rate" double precision DEFAULT 20,
	"default_payment_terms" integer DEFAULT 30,
	"quote_terms" text,
	"invoice_terms" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"last_read_at" timestamp,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"is_group" boolean DEFAULT false NOT NULL,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "defect_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"defect_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"comment" text,
	"status_change" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "defects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"check_id" varchar,
	"check_item_id" varchar,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"vehicle_off_road" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reported_by_id" varchar NOT NULL,
	"assigned_to_id" varchar,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"aggregate_type" text,
	"aggregate_id" varchar,
	"version" integer DEFAULT 1,
	"caused_by_id" varchar,
	"correlation_id" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "engineer_locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engineer_id" varchar NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy" double precision,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exceptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"context" jsonb DEFAULT '{}'::jsonb,
	"entity_type" text,
	"entity_id" varchar,
	"stack_trace" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by_id" varchar,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount" double precision NOT NULL,
	"vat_amount" double precision DEFAULT 0,
	"receipt_url" text,
	"mileage" double precision,
	"mileage_rate" double precision,
	"job_id" varchar,
	"client_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by_id" varchar,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "failed_actions_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar,
	"attempted_email" text,
	"action_attempted" text NOT NULL,
	"failure_reason" text,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"enabled_for_tenants" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"user_role" text NOT NULL,
	"category" text DEFAULT 'bug' NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"page" text,
	"status" text DEFAULT 'new' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"object_path" text NOT NULL,
	"mime_type" text,
	"size" integer,
	"client_id" varchar,
	"job_id" varchar,
	"expense_id" varchar,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"ai_suggestion" jsonb,
	"uploaded_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixed_costs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"amount" double precision NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"start_date" timestamp DEFAULT now(),
	"end_date" timestamp,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"field_key" text NOT NULL,
	"asset_type" text NOT NULL,
	"file_path" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_version_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"submitted_by" varchar,
	"status" text DEFAULT 'draft' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"submitted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "form_template_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "form_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'job_sheet' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inspection_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" varchar NOT NULL,
	"category" text NOT NULL,
	"item_name" text NOT NULL,
	"description" text,
	"result" text DEFAULT 'not_checked' NOT NULL,
	"severity" text,
	"notes" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_no" text NOT NULL,
	"job_id" varchar,
	"client_id" varchar,
	"site_address" text NOT NULL,
	"postcode" text,
	"inspection_type" text NOT NULL,
	"inspector_id" varchar NOT NULL,
	"inspection_date" timestamp DEFAULT now(),
	"status" text DEFAULT 'draft' NOT NULL,
	"overall_result" text,
	"notes" text,
	"weather_conditions" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"signature" jsonb,
	"client_signature" jsonb,
	"sign_off_lat" double precision,
	"sign_off_lng" double precision,
	"sign_off_address" text,
	"sign_off_timestamp" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_tokens" (
	"provider" text PRIMARY KEY NOT NULL,
	"tokens" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_chase_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"chase_number" integer DEFAULT 1 NOT NULL,
	"method" text DEFAULT 'email' NOT NULL,
	"message" text NOT NULL,
	"sent_at" timestamp,
	"sent_by_id" varchar,
	"response" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_no" text NOT NULL,
	"job_id" varchar,
	"quote_id" varchar,
	"customer_id" varchar,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"site_address" text,
	"site_postcode" text,
	"invoice_date" timestamp DEFAULT now(),
	"due_date" timestamp,
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"subtotal" double precision DEFAULT 0,
	"vat_rate" double precision DEFAULT 20,
	"vat_amount" double precision DEFAULT 0,
	"total" double precision DEFAULT 0,
	"notes" text,
	"status" text DEFAULT 'Draft' NOT NULL,
	"paid_at" timestamp,
	"sent_at" timestamp,
	"access_token" text,
	"created_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"scheduled_for" timestamp DEFAULT now(),
	"locked_at" timestamp,
	"locked_by" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"work_date" timestamp NOT NULL,
	"sequence" integer NOT NULL,
	"notes" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"engineer_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_no" text NOT NULL,
	"nickname" text,
	"client" text,
	"customer_name" text NOT NULL,
	"property_id" varchar,
	"property_name" text,
	"address" text,
	"postcode" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"date" timestamp DEFAULT now(),
	"session" text DEFAULT 'AM',
	"order_number" integer,
	"description" text,
	"works_completed" text,
	"works_completed_locked" boolean DEFAULT false,
	"notes" text,
	"status" text DEFAULT 'Draft' NOT NULL,
	"assigned_to_id" varchar,
	"assigned_to_ids" jsonb DEFAULT '[]'::jsonb,
	"materials" jsonb DEFAULT '[]'::jsonb,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"signatures" jsonb DEFAULT '[]'::jsonb,
	"further_actions" jsonb DEFAULT '[]'::jsonb,
	"sign_off_lat" double precision,
	"sign_off_lng" double precision,
	"sign_off_address" text,
	"sign_off_timestamp" timestamp,
	"order_index" integer DEFAULT 0,
	"is_long_running" boolean DEFAULT false,
	"required_skills" jsonb DEFAULT '[]'::jsonb,
	"urgency" text DEFAULT 'normal',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"updated_by_user_id" varchar,
	"quality_gate_status" text DEFAULT 'pending' NOT NULL,
	"completion_blocked_reason" text,
	"quality_override_by" varchar,
	"quality_override_reason" text
);
--> statement-breakpoint
CREATE TABLE "merchant_earnings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" varchar NOT NULL,
	"source_user_id" varchar NOT NULL,
	"amount" double precision NOT NULL,
	"type" varchar NOT NULL,
	"period_month" varchar NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"email" text,
	"password" text,
	"commission_rate" double precision DEFAULT 5 NOT NULL,
	"payout_method" varchar NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"category" text DEFAULT 'system' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"link_url" text,
	"email_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outlook_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_user_email" text,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"auto_extract" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"amount" double precision NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"card_last4" text,
	"card_brand" text,
	"reference" text,
	"notes" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_no" text NOT NULL,
	"customer_id" varchar,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"site_address" text,
	"site_postcode" text,
	"reference" text,
	"quote_date" timestamp DEFAULT now(),
	"expiry_date" timestamp,
	"description" text,
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"subtotal" double precision DEFAULT 0,
	"discount_total" double precision DEFAULT 0,
	"vat_rate" double precision DEFAULT 20,
	"vat_amount" double precision DEFAULT 0,
	"total" double precision DEFAULT 0,
	"terms" text,
	"notes" text,
	"status" text DEFAULT 'Draft' NOT NULL,
	"decline_reason" text,
	"accepted_at" timestamp,
	"declined_at" timestamp,
	"sent_at" timestamp,
	"access_token" text,
	"converted_job_id" varchar,
	"created_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"code" varchar NOT NULL,
	"landing_type" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_conversions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_code_id" varchar NOT NULL,
	"referred_user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"qualified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_code_id" varchar NOT NULL,
	"scanned_at" timestamp DEFAULT now(),
	"ip_hash" varchar NOT NULL,
	"user_agent_hash" varchar NOT NULL,
	"geo_country" varchar
);
--> statement-breakpoint
CREATE TABLE "review_rewards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"value_type" varchar NOT NULL,
	"value" double precision NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"event_type" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'trade' NOT NULL,
	"icon" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "snag_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snagging_sheet_id" varchar NOT NULL,
	"location" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to_id" varchar,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"completion_photos" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"resolved_at" timestamp,
	"resolved_by_id" varchar,
	"verified_at" timestamp,
	"verified_by_id" varchar,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "snagging_sheets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_no" text NOT NULL,
	"job_id" varchar,
	"client_id" varchar,
	"inspection_id" varchar,
	"site_address" text NOT NULL,
	"postcode" text,
	"created_by_id" varchar NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"total_snags" integer DEFAULT 0,
	"resolved_snags" integer DEFAULT 0,
	"notes" text,
	"client_signature" jsonb,
	"sign_off_lat" double precision,
	"sign_off_lng" double precision,
	"sign_off_address" text,
	"sign_off_timestamp" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "snippets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"shortcut" text,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sub_skills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_add_ons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" varchar,
	"add_on_id" varchar NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" timestamp DEFAULT now(),
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"monthly_price" double precision NOT NULL,
	"yearly_price" double precision,
	"features" jsonb DEFAULT '[]'::jsonb,
	"limits" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"stripe_price_id_monthly" text,
	"stripe_price_id_yearly" text,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly',
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"cancel_at_period_end" boolean DEFAULT false,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engineer_id" varchar NOT NULL,
	"clock_in_time" timestamp NOT NULL,
	"clock_out_time" timestamp,
	"clock_in_lat" double precision,
	"clock_in_lng" double precision,
	"clock_in_address" text,
	"clock_out_lat" double precision,
	"clock_out_lng" double precision,
	"clock_out_address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timesheets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"clock_in" timestamp,
	"clock_out" timestamp,
	"clock_in_latitude" double precision,
	"clock_in_longitude" double precision,
	"clock_in_address" text,
	"clock_out_latitude" double precision,
	"clock_out_longitude" double precision,
	"clock_out_address" text,
	"break_minutes" integer DEFAULT 0,
	"total_hours" double precision,
	"job_id" varchar,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by_id" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" varchar NOT NULL,
	"metric_type" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"user_id" varchar NOT NULL,
	"login_timestamp" timestamp NOT NULL,
	"logout_timestamp" timestamp,
	"last_activity" timestamp,
	"ip_address" text,
	"device_info" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "user_skills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"skill_id" varchar NOT NULL,
	"sub_skill_ids" jsonb DEFAULT '[]'::jsonb,
	"proficiency_level" text DEFAULT 'standard',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"tablet_number" text,
	"role" text DEFAULT 'engineer' NOT NULL,
	"roles" jsonb DEFAULT '["engineer"]'::jsonb,
	"super_admin" boolean DEFAULT false NOT NULL,
	"has_directors_suite" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"manager_id" varchar,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"county" text,
	"home_postcode" text,
	"day_rate" double precision,
	"home_lat" double precision,
	"home_lng" double precision,
	"current_lat" double precision,
	"current_lng" double precision,
	"last_location_update" timestamp,
	"licence_photo_url" text,
	"licence_uploaded_at" timestamp,
	"two_factor_secret" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"gdpr_consent_date" timestamp,
	"gdpr_consent_version" text,
	"deletion_requested_at" timestamp,
	"working_at_height" boolean DEFAULT false NOT NULL,
	"negative_skill_ids" jsonb DEFAULT '[]'::jsonb,
	"google_id" text,
	"profile_image_url" text,
	"invite_token" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration" text NOT NULL,
	"make" text,
	"model" text,
	"year" integer,
	"type" text,
	"status" text DEFAULT 'active' NOT NULL,
	"assigned_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "walkaround_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"check_type" text NOT NULL,
	"odometer" integer,
	"inspector_id" varchar NOT NULL,
	"overall_status" text DEFAULT 'pass' NOT NULL,
	"vehicle_safe_to_operate" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"response_status" integer,
	"response_body" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"event_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"retry_policy" jsonb DEFAULT '{"maxAttempts":3,"backoffMs":1000}'::jsonb,
	"created_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_executions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" varchar NOT NULL,
	"triggered_by_id" varchar,
	"trigger_data" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb,
	"error_message" text,
	"executed_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workflow_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" varchar NOT NULL,
	"step_index" integer NOT NULL,
	"action_type" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb,
	"output" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" text NOT NULL,
	"trigger_conditions" jsonb DEFAULT '{}'::jsonb,
	"actions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0,
	"created_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oauth_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "IDX_oauth_session_expire" ON "oauth_sessions" USING btree ("expire");