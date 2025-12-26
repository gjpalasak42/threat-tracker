CREATE TABLE "api_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"api_source" text NOT NULL,
	"endpoint" text NOT NULL,
	"indicator" text,
	"response_code" integer,
	"response_time" integer,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "threat_logs" ADD COLUMN "unified_risk_score" real;--> statement-breakpoint
ALTER TABLE "threat_logs" ADD COLUMN "sources_data" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "threat_logs" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD CONSTRAINT "api_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;