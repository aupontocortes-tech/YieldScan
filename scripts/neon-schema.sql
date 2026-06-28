-- YieldScan — schema de sincronização Neon (também criado automaticamente pela API)
CREATE TABLE IF NOT EXISTS yieldscan_sync (
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_yieldscan_sync_updated ON yieldscan_sync (updated_at DESC);
