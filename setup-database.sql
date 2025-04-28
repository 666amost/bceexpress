-- Create shipments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.shipments (
  awb_number TEXT PRIMARY KEY,
  sender_name TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  receiver_name TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  receiver_phone TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  dimensions TEXT NOT NULL,
  service_type TEXT NOT NULL,
  current_status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shipment_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.shipment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  awb_number TEXT NOT NULL REFERENCES public.shipments(awb_number),
  status TEXT NOT NULL,
  location TEXT NOT NULL,
  notes TEXT,
  photo_url TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('courier', 'admin', 'customer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up RLS (Row Level Security)
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for shipments
CREATE POLICY "Anyone can view shipments" 
  ON public.shipments 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert shipments" 
  ON public.shipments 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update shipments" 
  ON public.shipments 
  FOR UPDATE 
  TO authenticated 
  USING (true);

-- Create policies for shipment_history
CREATE POLICY "Anyone can view shipment history" 
  ON public.shipment_history 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert shipment history" 
  ON public.shipment_history 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Create policies for users
CREATE POLICY "Users can view their own profile" 
  ON public.users 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Service role can manage all users" 
  ON public.users 
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create a sample shipment for testing
INSERT INTO public.shipments (
  awb_number, 
  sender_name, 
  sender_address, 
  sender_phone, 
  receiver_name, 
  receiver_address, 
  receiver_phone, 
  weight, 
  dimensions, 
  service_type, 
  current_status
) VALUES (
  'BCE123456789', 
  'John Doe', 
  '123 Sender St, Jakarta', 
  '+62 123 456 789', 
  'Jane Smith', 
  '456 Receiver Ave, Surabaya', 
  '+62 987 654 321', 
  5.5, 
  '30x20x15 cm', 
  'Express', 
  'processed'
) ON CONFLICT (awb_number) DO NOTHING;

-- Create a sample shipment history entry
INSERT INTO public.shipment_history (
  awb_number, 
  status, 
  location, 
  notes
) VALUES (
  'BCE123456789', 
  'processed', 
  'Jakarta Sorting Center', 
  'Package received at sorting facility'
) ON CONFLICT DO NOTHING;

-- Create storage bucket for shipment photos if it doesn't exist
-- Note: This needs to be done in the Supabase dashboard or using the Supabase API
