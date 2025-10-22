-- ============================================
-- MIGRACIÓN: Sistema de Créditos Mejorado (Versión Original)
-- Esta es la versión original de nextjs/supabase-migration.sql
-- Las funciones ya están aplicadas y actualizadas en la migración 20251019180508
-- Mantener para referencia histórica - NO EJECUTAR
-- ============================================

-- Función mejorada para registrar transacciones de créditos
-- Compatible con la estructura existente de credit_transactions
CREATE OR REPLACE FUNCTION log_credit_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_purchase_id UUID DEFAULT NULL,
  p_video_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Registrar transacción usando la estructura existente
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

-- Función mejorada para consumir créditos con logging automático
CREATE OR REPLACE FUNCTION consume_credit_for_video(
  p_user_id UUID,
  p_video_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
  v_cost INTEGER := 1; -- Costo por defecto de 1 crédito por video
BEGIN
  -- Obtener balance actual
  SELECT credits_balance INTO v_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Registrar consumo usando la función de logging
  PERFORM log_credit_transaction(
    p_user_id,
    -v_cost,
    'video_generation',
    NULL, -- purchase_id
    p_video_id, -- video_id
    'Video generation cost'
  );

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Función mejorada para aplicar compras de créditos con logging automático
CREATE OR REPLACE FUNCTION apply_credit_purchase(
  p_purchase_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase RECORD;
BEGIN
  -- Obtener datos de la compra
  SELECT * INTO v_purchase
  FROM credit_purchases
  WHERE id = p_purchase_id AND payment_status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found or not approved';
  END IF;

  -- Verificar que no haya sido aplicada ya
  IF v_purchase.applied_at IS NOT NULL THEN
    RETURN TRUE; -- Ya fue aplicada, retornar éxito
  END IF;

  -- Marcar como aplicada
  UPDATE credit_purchases
  SET applied_at = NOW()
  WHERE id = p_purchase_id;

  -- Registrar créditos usando la función de logging
  PERFORM log_credit_transaction(
    v_purchase.user_id,
    v_purchase.credits_amount,
    'purchase',
    p_purchase_id, -- purchase_id
    NULL, -- video_id
    'Credit purchase: ' || v_purchase.package_name
  );

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Función mejorada para reembolsar créditos por videos fallidos
CREATE OR REPLACE FUNCTION refund_credits_for_video(
  p_video_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_video RECORD;
  v_refund_amount INTEGER;
BEGIN
  -- Obtener datos del video
  SELECT * INTO v_video
  FROM video_generations
  WHERE id = p_video_id AND status = 'failed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Video generation not found or not failed';
  END IF;

  -- Verificar que no haya sido reembolsado ya
  IF EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE video_id = p_video_id AND transaction_type = 'refund'
  ) THEN
    RETURN TRUE; -- Ya fue reembolsado
  END IF;

  v_refund_amount := COALESCE(v_video.credits_used, 1);

  -- Registrar reembolso usando la función de logging
  PERFORM log_credit_transaction(
    v_video.user_id,
    v_refund_amount,
    'refund',
    NULL, -- purchase_id
    p_video_id, -- video_id
    'Refund for failed video generation'
  );

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Verificar que las funciones se crearon correctamente
SELECT
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN (
  'log_credit_transaction',
  'consume_credit_for_video',
  'apply_credit_purchase',
  'refund_credits_for_video'
)
ORDER BY proname;