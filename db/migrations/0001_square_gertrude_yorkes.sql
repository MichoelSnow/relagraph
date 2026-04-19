CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_graph" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "entity" ADD COLUMN "graph_id" uuid;--> statement-breakpoint
ALTER TABLE "relationship" ADD COLUMN "graph_id" uuid;--> statement-breakpoint
ALTER TABLE "user_graph" ADD CONSTRAINT "user_graph_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_app_user_email" ON "app_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_user_graph_owner_user_id" ON "user_graph" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_user_session_user_id" ON "user_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_session_expires_at" ON "user_session" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_graph_id_user_graph_id_fk" FOREIGN KEY ("graph_id") REFERENCES "public"."user_graph"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_graph_id_user_graph_id_fk" FOREIGN KEY ("graph_id") REFERENCES "public"."user_graph"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_entity_graph_id" ON "entity" USING btree ("graph_id");--> statement-breakpoint
CREATE INDEX "idx_relationship_graph_id" ON "relationship" USING btree ("graph_id");