CREATE TABLE "purchase_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"amount_fen" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reference" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_payments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pricing_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_mode" text;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_payments_order_idx" ON "purchase_payments" USING btree ("order_id");