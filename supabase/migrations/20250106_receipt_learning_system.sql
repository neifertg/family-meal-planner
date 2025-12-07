-- Receipt Learning System
-- Stores receipt scan history and user corrections to improve AI accuracy over time

-- Table to store receipt scan sessions
CREATE TABLE IF NOT EXISTS receipt_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  store_name TEXT,
  purchase_date DATE,
  scan_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confidence_score NUMERIC(5,2), -- Overall confidence from AI
  tokens_used INTEGER,
  cost_usd NUMERIC(10,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store individual item extractions and corrections
CREATE TABLE IF NOT EXISTS receipt_item_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_scan_id UUID NOT NULL REFERENCES receipt_scans(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,

  -- Original AI extraction
  ai_extracted_name TEXT NOT NULL,
  ai_extracted_quantity TEXT,
  ai_extracted_price NUMERIC(10,2),
  ai_extracted_category TEXT,

  -- User-approved final version
  corrected_name TEXT NOT NULL,
  corrected_quantity TEXT,
  corrected_price NUMERIC(10,2),
  corrected_category TEXT,

  -- Track if user made changes
  was_corrected BOOLEAN DEFAULT false,
  was_removed BOOLEAN DEFAULT false, -- If user deleted this item

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipt_scans_family ON receipt_scans(family_id);
CREATE INDEX IF NOT EXISTS idx_receipt_scans_store ON receipt_scans(store_name);
CREATE INDEX IF NOT EXISTS idx_receipt_scans_date ON receipt_scans(scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_corrections_family ON receipt_item_corrections(family_id);
CREATE INDEX IF NOT EXISTS idx_receipt_corrections_receipt ON receipt_item_corrections(receipt_scan_id);
CREATE INDEX IF NOT EXISTS idx_receipt_corrections_store_name ON receipt_item_corrections(family_id, was_corrected)
  WHERE was_corrected = true;

-- RLS Policies
ALTER TABLE receipt_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_item_corrections ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to access receipt data
CREATE POLICY "Allow all for authenticated users" ON receipt_scans
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON receipt_item_corrections
  FOR ALL USING (auth.role() = 'authenticated');
