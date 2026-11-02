-- Apply with the direct Neon URL before starting a PostgreSQL-backed relay.
CREATE TABLE IF NOT EXISTS avaclash_relay_games (
  chain_id bigint NOT NULL,
  escrow_address text NOT NULL CHECK (escrow_address = lower(escrow_address)),
  room_id bigint NOT NULL CHECK (room_id >= 0),
  active_state jsonb,
  result jsonb,
  revision bigint NOT NULL DEFAULT 0,
  lease_owner text,
  lease_until timestamptz NOT NULL DEFAULT '-infinity',
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (chain_id, escrow_address, room_id),
  CHECK (result IS NULL OR active_state IS NULL)
);
