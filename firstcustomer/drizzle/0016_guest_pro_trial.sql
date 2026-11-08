ALTER TABLE "pro_trial_claims" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pro_trial_claims" ADD COLUMN "guest_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "pro_trial_guest_idx" ON "pro_trial_claims" USING btree ("guest_hash");