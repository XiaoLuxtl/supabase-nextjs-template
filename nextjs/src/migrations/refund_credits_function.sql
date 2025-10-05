-- Function to refund credits for a failed video generation
CREATE OR REPLACE FUNCTION refund_credits_for_video(
    p_video_id UUID
)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credits_used INTEGER;
    v_user_id UUID;
    v_status TEXT;
BEGIN
    -- Get video generation details
    SELECT credits_used, user_id, status
    INTO v_credits_used, v_user_id, v_status
    FROM public.video_generations
    WHERE id = p_video_id;

    -- Validate the video exists and is in failed status
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Video generation not found';
    END IF;

    IF v_status != 'failed' THEN
        RAISE EXCEPTION 'Can only refund credits for failed generations';
    END IF;

    -- Update user credits - add back the used credits
    UPDATE public.user_profiles
    SET credits = credits + v_credits_used
    WHERE id = v_user_id;

    -- Log the refund in a new credits_history table (if you have one)
    -- INSERT INTO credits_history(user_id, amount, type, reference_id)
    -- VALUES (v_user_id, v_credits_used, 'refund', p_video_id);

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return false
        RETURN FALSE;
END;
$$;