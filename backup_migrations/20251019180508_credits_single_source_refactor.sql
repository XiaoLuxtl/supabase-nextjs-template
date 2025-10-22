-- ============================================
-- MIGRACIÓN: Refactor para Single Source of Truth en Créditos
-- Fecha: 2025-10-19
-- ============================================

-- Eliminar funciones existentes para evitar conflictos de tipo de retorno
DROP FUNCTION IF EXISTS consume_credit_for_video(UUID, UUID);
DROP FUNCTION IF EXISTS apply_credit_purchase(UUID);
DROP FUNCTION IF EXISTS refund_credits_for_video(UUID);

-- Función consolidada para logging de transacciones de créditos
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

-- Función para consumir créditos por video
CREATE FUNCTION consume_credit_for_video(
  p_user_id UUID,
  p_video_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
  v_cost INTEGER := 1;
BEGIN
  -- Verificar balance
  SELECT credits_balance INTO v_new_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_new_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Consumir y obtener nuevo balance
  SELECT log_credit_transaction(
    p_user_id,
    -v_cost,
    'video_generation',
    NULL,
    p_video_id,
    'Video generation cost'
  ) INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- Función para aplicar compras de créditos
CREATE FUNCTION apply_credit_purchase(
  p_purchase_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase RECORD;
  v_new_balance INTEGER;
BEGIN
  SELECT * INTO v_purchase
  FROM credit_purchases
  WHERE id = p_purchase_id AND payment_status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found or not approved';
  END IF;

  IF v_purchase.applied_at IS NOT NULL THEN
    -- Ya aplicado, devolver balance actual
    SELECT credits_balance INTO v_new_balance
    FROM user_profiles
    WHERE id = v_purchase.user_id;
    RETURN v_new_balance;
  END IF;

  UPDATE credit_purchases
  SET applied_at = NOW()
  WHERE id = p_purchase_id;

  -- Registrar transacción y obtener nuevo balance
  SELECT log_credit_transaction(
    v_purchase.user_id,
    v_purchase.credits_amount,
    'purchase',
    p_purchase_id,
    NULL,
    'Credit purchase: ' || v_purchase.package_name
  ) INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- Función para reembolsar créditos por videos fallidos
CREATE FUNCTION refund_credits_for_video(
  p_video_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_video RECORD;
  v_refund_amount INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT * INTO v_video
  FROM video_generations
  WHERE id = p_video_id AND status = 'failed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Video generation not found or not failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE video_id = p_video_id AND transaction_type = 'refund'
  ) THEN
    -- Ya reembolsado, devolver balance actual
    SELECT credits_balance INTO v_new_balance
    FROM user_profiles
    WHERE id = v_video.user_id;
    RETURN v_new_balance;
  END IF;

  v_refund_amount := COALESCE(v_video.credits_used, 1);

  -- Reembolsar y obtener nuevo balance
  SELECT log_credit_transaction(
    v_video.user_id,
    v_refund_amount,
    'refund',
    NULL,
    p_video_id,
    'Refund for failed video generation'
  ) INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- Trigger para asegurar consistencia: prevenir updates directos a credits_balance
-- Solo permitir updates desde funciones SECURITY DEFINER
CREATE OR REPLACE FUNCTION check_credit_balance_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Crear trigger (comentado por ahora, activar si es necesario)
-- CREATE TRIGGER credit_balance_update_trigger
--   BEFORE UPDATE OF credits_balance ON user_profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION check_credit_balance_update();

-- Verificar funciones
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