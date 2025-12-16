-- Drop orders table and related objects
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Service role can manage all orders" ON public.orders;
DROP INDEX IF EXISTS idx_orders_user_id;
DROP INDEX IF EXISTS idx_orders_polar_order_id;
DROP INDEX IF EXISTS idx_orders_subscription_id;
DROP TABLE IF EXISTS public.orders;
