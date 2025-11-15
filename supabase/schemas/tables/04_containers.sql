-- Containers Table
-- Containers are collections of templates in a specific order

CREATE TABLE IF NOT EXISTS containers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    template_order uuid[] DEFAULT ARRAY[]::uuid[],
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_containers_user_id ON containers(user_id);

-- RLS Policies
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own containers"
    ON containers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own containers"
    ON containers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own containers"
    ON containers FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own containers"
    ON containers FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_containers_updated_at
    BEFORE UPDATE ON containers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
