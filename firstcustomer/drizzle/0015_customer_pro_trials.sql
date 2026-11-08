CREATE TABLE "pro_trial_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"project_id" uuid,
	"order_id" uuid,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pro_trial_claims" ADD CONSTRAINT "pro_trial_claims_customer_id_auth_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_trial_claims" ADD CONSTRAINT "pro_trial_claims_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_trial_claims" ADD CONSTRAINT "pro_trial_claims_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pro_trial_customer_idx" ON "pro_trial_claims" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pro_trial_project_idx" ON "pro_trial_claims" USING btree ("project_id");