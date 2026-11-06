CREATE TABLE "company_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"dedupe_key" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"provider" text,
	"model" text,
	"list_cost_yuan" double precision DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "company_reports_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"charter" text DEFAULT '' NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"service" text DEFAULT '' NOT NULL,
	"operations" text DEFAULT '' NOT NULL,
	"forbidden_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"charter_version" integer DEFAULT 0 NOT NULL,
	"charter_confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"question" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"risk" text,
	"reply" text,
	"draft" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decisions" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_messages_project_idx" ON "support_messages" USING btree ("project_id","created_at");