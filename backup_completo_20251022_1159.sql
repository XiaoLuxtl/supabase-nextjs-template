


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."apply_credit_purchase"("p_purchase_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_purchase RECORD;
  v_new_balance INTEGER;
BEGIN
  -- Obtener la compra con lock
  SELECT * INTO v_purchase
  FROM credit_purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  -- Verificar que existe
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Purchase not found'
    );
  END IF;

  -- Verificar que esté aprobado
  IF v_purchase.payment_status != 'approved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Purchase not approved',
      'status', v_purchase.payment_status
    );
  END IF;

  -- Si ya se aplicó, retornar éxito con balance actual
  IF v_purchase.applied_at IS NOT NULL THEN
    SELECT credits_balance INTO v_new_balance
    FROM user_profiles
    WHERE id = v_purchase.user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Credits already applied',
      'already_applied', true,
      'new_balance', v_new_balance
    );
  END IF;

  -- Marcar como aplicado
  UPDATE credit_purchases
  SET applied_at = NOW(),
      updated_at = NOW()
  WHERE id = p_purchase_id;

  -- Registrar transacción y obtener nuevo balance usando tu función existente
  SELECT log_credit_transaction(
    v_purchase.user_id,
    v_purchase.credits_amount,
    'purchase',
    p_purchase_id,
    NULL,
    'Credit purchase: ' || v_purchase.package_name
  ) INTO v_new_balance;

  -- Retornar resultado en formato JSONB
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'credits_added', v_purchase.credits_amount
  );
END;
$$;


ALTER FUNCTION "public"."apply_credit_purchase"("p_purchase_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_custom_package_price"("p_package_id" "uuid", "p_credits_amount" integer) RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_min_credits INTEGER;
  v_price_per_credit DECIMAL;
  v_total_price DECIMAL;
BEGIN
  SELECT min_credits, price_per_credit
  INTO v_min_credits, v_price_per_credit
  FROM credit_packages
  WHERE id = p_package_id AND package_type = 'custom';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Custom package not found';
  END IF;
  
  IF p_credits_amount < v_min_credits THEN
    RAISE EXCEPTION 'Credits amount below minimum: %', v_min_credits;
  END IF;
  
  v_total_price := p_credits_amount * v_price_per_credit;
  RETURN v_total_price;
END;
$$;


ALTER FUNCTION "public"."calculate_custom_package_price"("p_package_id" "uuid", "p_credits_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_credit_balance_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Si el update viene de una función SECURITY DEFINER, permitir
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Para otros casos, verificar si es un update legítimo
  -- Por ahora, permitir pero loggear
  RAISE NOTICE 'Direct update to credits_balance detected for user %', NEW.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_credit_balance_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_credit_for_video"("p_user_id" "uuid", "p_video_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_cost INTEGER := 1;
BEGIN
  -- Obtener balance actual con lock
  SELECT credits_balance INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Verificar que existe el usuario
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Verificar balance suficiente
  IF v_current_balance < v_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'current_balance', v_current_balance,
      'required', v_cost
    );
  END IF;

  -- Consumir crédito usando tu función existente
  SELECT log_credit_transaction(
    p_user_id,
    -v_cost,
    'video_generation',
    NULL,
    p_video_id,
    'Video generation cost'
  ) INTO v_new_balance;

  -- Retornar resultado en formato JSONB
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'previous_balance', v_current_balance,
    'credits_consumed', v_cost
  );
END;
$$;


ALTER FUNCTION "public"."consume_credit_for_video"("p_user_id" "uuid", "p_video_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insertar perfil con manejo de errores
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING; -- Evitar error si ya existe
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log del error (visible en Auth logs)
    RAISE WARNING 'Error creating user profile for %: %', NEW.email, SQLERRM;
    RETURN NEW; -- Continuar aunque falle
END;
$$;


ALTER FUNCTION "public"."create_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_authenticated"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
SELECT
  CASE
    WHEN auth.jwt() ->> 'aal' IS NULL THEN false
    WHEN EXISTS (
      SELECT 1 FROM auth.mfa_factors
      WHERE user_id::text = auth.uid()::text
        AND status = 'verified'
      LIMIT 1
    ) THEN (auth.jwt() ->> 'aal') = 'aal2'
    ELSE (auth.jwt() ->> 'aal') IN ('aal1','aal2')
  END;
$$;


ALTER FUNCTION "public"."is_user_authenticated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_credit_transaction"("p_user_id" "uuid", "p_amount" integer, "p_transaction_type" "text", "p_purchase_id" "uuid" DEFAULT NULL::"uuid", "p_video_id" "uuid" DEFAULT NULL::"uuid", "p_description" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Obtener balance actual
  SELECT credits_balance INTO v_new_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Calcular nuevo balance
  v_new_balance := v_new_balance + p_amount;

  -- Actualizar balance del usuario
  UPDATE user_profiles
  SET credits_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Registrar transacción
  INSERT INTO credit_transactions (
    user_id,
    amount,
    balance_after,
    transaction_type,
    purchase_id,
    video_id,
    description
  ) VALUES (
    p_user_id,
    p_amount,
    v_new_balance,
    p_transaction_type,
    p_purchase_id,
    p_video_id,
    p_description
  );

  RETURN v_new_balance;
END;
$$;


ALTER FUNCTION "public"."log_credit_transaction"("p_user_id" "uuid", "p_amount" integer, "p_transaction_type" "text", "p_purchase_id" "uuid", "p_video_id" "uuid", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_credit_for_failed_video"("p_video_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_new_balance INTEGER;
BEGIN
  SELECT user_id INTO v_user_id
  FROM video_generations
  WHERE id = p_video_id 
    AND status = 'failed' 
    AND credits_used > 0;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  UPDATE user_profiles
  SET 
    credits_balance = credits_balance + 1,
    total_videos_generated = total_videos_generated - 1
  WHERE id = v_user_id
  RETURNING credits_balance INTO v_new_balance;
  
  INSERT INTO credit_transactions (
    user_id, amount, balance_after, transaction_type,
    video_id, description
  ) VALUES (
    v_user_id, 1, v_new_balance, 'refund',
    p_video_id, 'Reembolso por video fallido'
  );
  
  UPDATE video_generations
  SET credits_used = 0
  WHERE id = p_video_id;
END;
$$;


ALTER FUNCTION "public"."refund_credit_for_failed_video"("p_video_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_credits_for_video"("p_video_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_credits_used INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Obtener info del video con lock
  SELECT user_id, credits_used INTO v_user_id, v_credits_used
  FROM video_generations
  WHERE id = p_video_id
  FOR UPDATE;
  
  -- Verificar que existe
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Video generation not found'
    );
  END IF;
  
  -- Verificar que haya créditos consumidos
  IF COALESCE(v_credits_used, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'No credits to refund',
      'already_refunded', true
    );
  END IF;
  
  -- Reembolsar usando tu función log_credit_transaction
  SELECT log_credit_transaction(
    v_user_id,
    v_credits_used,
    'refund',
    NULL,
    p_video_id,
    'Reembolso por video fallido'
  ) INTO v_new_balance;
  
  -- Marcar créditos como reembolsados
  UPDATE video_generations
  SET credits_used = 0,
      updated_at = NOW()
  WHERE id = p_video_id;
  
  -- Retornar resultado en formato JSONB
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'credits_refunded', v_credits_used
  );
END;
$$;


ALTER FUNCTION "public"."refund_credits_for_video"("p_video_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_daily_generation_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.daily_reset_date < CURRENT_DATE THEN
    NEW.daily_generations_used = 0;
    NEW.daily_reset_date = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."reset_daily_generation_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."credit_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "package_type" "text" NOT NULL,
    "credits_amount" integer,
    "price_mxn" numeric(10,2),
    "min_credits" integer,
    "price_per_credit" numeric(10,2),
    "description" "text",
    "features" "jsonb",
    "is_active" boolean DEFAULT true,
    "is_popular" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fixed_package_has_values" CHECK (((("package_type" = 'fixed'::"text") AND ("credits_amount" IS NOT NULL) AND ("price_mxn" IS NOT NULL)) OR (("package_type" = 'custom'::"text") AND ("min_credits" IS NOT NULL) AND ("price_per_credit" IS NOT NULL)))),
    CONSTRAINT "valid_package_type" CHECK (("package_type" = ANY (ARRAY['fixed'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."credit_packages" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_packages" IS 'Paquetes fijos y personalizables de créditos';



CREATE TABLE IF NOT EXISTS "public"."credit_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "package_name" "text" NOT NULL,
    "credits_amount" integer NOT NULL,
    "price_paid_mxn" numeric(10,2) NOT NULL,
    "payment_method" "text" DEFAULT 'mercadopago'::"text",
    "payment_id" "text",
    "preference_id" "text",
    "payment_status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "applied_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."credit_purchases" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_purchases" IS 'Historial de compras vía Mercado Pago';



CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "purchase_id" "uuid",
    "video_id" "uuid",
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_transaction_type" CHECK (("transaction_type" = ANY (ARRAY['purchase'::"text", 'video_generation'::"text", 'refund'::"text", 'admin_adjustment'::"text", 'bonus'::"text"])))
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_transactions" IS 'Log de movimientos de créditos';



CREATE TABLE IF NOT EXISTS "public"."mercadopago_webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "text",
    "event_type" "text",
    "payload" "jsonb",
    "signature" "text",
    "is_valid" boolean,
    "processed" boolean DEFAULT false,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mercadopago_webhook_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "avatar_url" "text",
    "credits_balance" integer DEFAULT 0 NOT NULL,
    "total_credits_purchased" integer DEFAULT 0 NOT NULL,
    "total_videos_generated" integer DEFAULT 0 NOT NULL,
    "daily_generation_limit" integer DEFAULT 10,
    "daily_generations_used" integer DEFAULT 0,
    "daily_reset_date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_login_at" timestamp with time zone
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS 'Perfiles de usuario con sistema de créditos';



CREATE TABLE IF NOT EXISTS "public"."video_generations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prompt" "text" NOT NULL,
    "model" "text" DEFAULT 'vidu-1.5'::"text",
    "duration" integer DEFAULT 5,
    "aspect_ratio" "text" DEFAULT '16:9'::"text",
    "resolution" "text" DEFAULT '1080p'::"text",
    "vidu_task_id" "text",
    "vidu_creation_id" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "credits_used" integer DEFAULT 1,
    "video_url" "text",
    "cover_url" "text",
    "video_duration_actual" integer,
    "video_fps" integer,
    "bgm" boolean DEFAULT false,
    "error_message" "text",
    "error_code" "text",
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "vidu_full_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "translated_prompt_en" "text",
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'queued'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."video_generations" OWNER TO "postgres";


COMMENT ON TABLE "public"."video_generations" IS 'Historial de videos generados';



CREATE TABLE IF NOT EXISTS "public"."vidu_webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vidu_task_id" "text",
    "payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false,
    "error_message" "text",
    "received_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vidu_webhook_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."vidu_webhook_logs" IS 'Log de webhooks de Vidu';



ALTER TABLE ONLY "public"."credit_packages"
    ADD CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_packages"
    ADD CONSTRAINT "credit_packages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mercadopago_webhook_logs"
    ADD CONSTRAINT "mercadopago_webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_generations"
    ADD CONSTRAINT "video_generations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_generations"
    ADD CONSTRAINT "video_generations_vidu_task_id_key" UNIQUE ("vidu_task_id");



ALTER TABLE ONLY "public"."vidu_webhook_logs"
    ADD CONSTRAINT "vidu_webhook_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_credit_purchases_applied_null" ON "public"."credit_purchases" USING "btree" ("applied_at") WHERE ("applied_at" IS NULL);



CREATE INDEX "idx_credit_purchases_created_desc" ON "public"."credit_purchases" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_credit_purchases_preference" ON "public"."credit_purchases" USING "btree" ("preference_id");



CREATE INDEX "idx_credit_purchases_user_pending" ON "public"."credit_purchases" USING "btree" ("user_id", "payment_status") WHERE ("payment_status" = 'pending'::"text");



CREATE INDEX "idx_credit_transactions_created_at" ON "public"."credit_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_credit_transactions_purchase_id" ON "public"."credit_transactions" USING "btree" ("purchase_id") WHERE ("purchase_id" IS NOT NULL);



CREATE INDEX "idx_credit_transactions_user_id" ON "public"."credit_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_credit_transactions_video_id" ON "public"."credit_transactions" USING "btree" ("video_id") WHERE ("video_id" IS NOT NULL);



CREATE INDEX "idx_mp_webhooks_created_at" ON "public"."mercadopago_webhook_logs" USING "btree" ("created_at");



CREATE INDEX "idx_mp_webhooks_payment_id" ON "public"."mercadopago_webhook_logs" USING "btree" ("payment_id");



CREATE INDEX "idx_mp_webhooks_valid" ON "public"."mercadopago_webhook_logs" USING "btree" ("is_valid");



CREATE INDEX "idx_packages_active" ON "public"."credit_packages" USING "btree" ("is_active", "sort_order");



CREATE INDEX "idx_packages_slug" ON "public"."credit_packages" USING "btree" ("slug");



CREATE INDEX "idx_packages_type" ON "public"."credit_packages" USING "btree" ("package_type");



CREATE INDEX "idx_purchases_payment_id" ON "public"."credit_purchases" USING "btree" ("payment_id");



CREATE INDEX "idx_purchases_preference" ON "public"."credit_purchases" USING "btree" ("preference_id");



CREATE INDEX "idx_purchases_status" ON "public"."credit_purchases" USING "btree" ("payment_status");



CREATE INDEX "idx_purchases_user" ON "public"."credit_purchases" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_transactions_type" ON "public"."credit_transactions" USING "btree" ("transaction_type");



CREATE INDEX "idx_transactions_user" ON "public"."credit_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE INDEX "idx_user_profiles_phone" ON "public"."user_profiles" USING "btree" ("phone");



CREATE INDEX "idx_videos_pending" ON "public"."video_generations" USING "btree" ("status", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'queued'::"text"]));



CREATE INDEX "idx_videos_status" ON "public"."video_generations" USING "btree" ("status");



CREATE INDEX "idx_videos_user_created" ON "public"."video_generations" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_videos_vidu_task" ON "public"."video_generations" USING "btree" ("vidu_task_id");



CREATE INDEX "idx_webhook_logs_processed" ON "public"."vidu_webhook_logs" USING "btree" ("processed", "received_at");



CREATE INDEX "idx_webhook_logs_task" ON "public"."vidu_webhook_logs" USING "btree" ("vidu_task_id");



CREATE OR REPLACE TRIGGER "check_daily_reset_before_update" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."reset_daily_generation_count"();



CREATE OR REPLACE TRIGGER "update_credit_packages_updated_at" BEFORE UPDATE ON "public"."credit_packages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."credit_packages"("id");



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."credit_purchases"("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."video_generations"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_generations"
    ADD CONSTRAINT "video_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view active packages" ON "public"."credit_packages" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Users can insert own videos" ON "public"."video_generations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own purchases" ON "public"."credit_purchases" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own transactions" ON "public"."credit_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own videos" ON "public"."video_generations" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."credit_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_generations" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."video_generations";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."apply_credit_purchase"("p_purchase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_credit_purchase"("p_purchase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_credit_purchase"("p_purchase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_custom_package_price"("p_package_id" "uuid", "p_credits_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_custom_package_price"("p_package_id" "uuid", "p_credits_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_custom_package_price"("p_package_id" "uuid", "p_credits_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_credit_balance_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_credit_balance_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_credit_balance_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_credit_for_video"("p_user_id" "uuid", "p_video_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_credit_for_video"("p_user_id" "uuid", "p_video_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_credit_for_video"("p_user_id" "uuid", "p_video_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_authenticated"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_authenticated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_authenticated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_credit_transaction"("p_user_id" "uuid", "p_amount" integer, "p_transaction_type" "text", "p_purchase_id" "uuid", "p_video_id" "uuid", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_credit_transaction"("p_user_id" "uuid", "p_amount" integer, "p_transaction_type" "text", "p_purchase_id" "uuid", "p_video_id" "uuid", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_credit_transaction"("p_user_id" "uuid", "p_amount" integer, "p_transaction_type" "text", "p_purchase_id" "uuid", "p_video_id" "uuid", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."refund_credit_for_failed_video"("p_video_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refund_credit_for_failed_video"("p_video_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_credit_for_failed_video"("p_video_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refund_credits_for_video"("p_video_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refund_credits_for_video"("p_video_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_credits_for_video"("p_video_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_daily_generation_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_daily_generation_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_daily_generation_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."credit_packages" TO "anon";
GRANT ALL ON TABLE "public"."credit_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_packages" TO "service_role";



GRANT ALL ON TABLE "public"."credit_purchases" TO "anon";
GRANT ALL ON TABLE "public"."credit_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."mercadopago_webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."mercadopago_webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."mercadopago_webhook_logs" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."video_generations" TO "anon";
GRANT ALL ON TABLE "public"."video_generations" TO "authenticated";
GRANT ALL ON TABLE "public"."video_generations" TO "service_role";



GRANT ALL ON TABLE "public"."vidu_webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."vidu_webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."vidu_webhook_logs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
