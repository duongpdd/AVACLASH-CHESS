import crypto from "node:crypto";
import { Pool } from "pg";
import type { ActiveGameState, SavedGameResult } from "./RelayServer.js";

export interface StoredGame {
  active_state: ActiveGameState | null;
  result: SavedGameResult | null;
  revision: string;
}

/** Keep TLS verification enabled even for URLs copied with sslmode=require. */
export function databasePool(connectionString: string): Pool {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw Error("DATABASE_URL must be a PostgreSQL URL.");
  url.searchParams.set("sslmode", "verify-full");
  return new Pool({
    connectionString: url.toString(),
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 10_000,
    application_name: "avaclash-relay",
    enableChannelBinding: true,
  });
}

/** Database-clock leases and revision checks fence off overlapping Render instances. */
export class PostgresStore {
  readonly pool: Pool;
  private readonly owner = crypto.randomUUID();
  private readonly revisions = new Map<number, string>();
  private heartbeat?: NodeJS.Timeout;
  private renewing = false;
  private stopped = false;
  private failed = false;
  public onFailure?: () => void;

  constructor(
    connectionString: string,
    readonly chainId: number,
    readonly escrow: string,
  ) {
    this.escrow = escrow.toLowerCase();
    this.pool = databasePool(connectionString);
    this.pool.on("error", () => this.fail());
  }

  private fail(): void {
    if (this.stopped || this.failed) return;
    this.failed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.onFailure?.();
  }

  assertAvailable(): void {
    if (this.failed || this.stopped)
      throw Error("Relay database unavailable; reconnect after restart.");
  }

  async check(): Promise<void> {
    this.assertAvailable();
    await this.pool.query(
      "SELECT chain_id, escrow_address, room_id, active_state, result, revision, lease_owner, lease_until FROM avaclash_relay_games LIMIT 0",
    );
  }

  async read(roomId: number): Promise<StoredGame | undefined> {
    this.assertAvailable();
    const result = await this.pool.query<StoredGame>(
      "SELECT active_state, result, revision::text FROM avaclash_relay_games WHERE chain_id=$1 AND escrow_address=$2 AND room_id=$3",
      [this.chainId, this.escrow, roomId],
    );
    return result.rows[0];
  }

  async claim(roomId: number): Promise<StoredGame> {
    this.assertAvailable();
    const result = await this.pool.query<StoredGame>(
      `INSERT INTO avaclash_relay_games (chain_id, escrow_address, room_id, lease_owner, lease_until)
       VALUES ($1,$2,$3,$4,clock_timestamp()+interval '45 seconds')
       ON CONFLICT (chain_id,escrow_address,room_id) DO UPDATE
       SET lease_owner=$4, lease_until=clock_timestamp()+interval '45 seconds'
       WHERE avaclash_relay_games.result IS NULL AND
         (avaclash_relay_games.lease_owner=$4 OR avaclash_relay_games.lease_until<clock_timestamp())
       RETURNING active_state, result, revision::text`,
      [this.chainId, this.escrow, roomId, this.owner],
    );
    const row = result.rows[0];
    if (!row) {
      const existing = await this.read(roomId);
      if (existing?.result) return existing;
      throw Error(
        "Room is reconnecting on another relay instance. Retry in 45 seconds.",
      );
    }
    this.revisions.set(roomId, row.revision);
    this.startHeartbeat();
    return row;
  }

  private startHeartbeat(): void {
    if (this.heartbeat) return;
    // Only rooms that are actually waiting/playing hold a lease. No idle keep-alive.
    this.heartbeat = setInterval(() => {
      void this.renew();
    }, 10_000);
    this.heartbeat.unref();
  }

  private async renew(): Promise<void> {
    if (
      this.renewing ||
      this.stopped ||
      this.failed ||
      this.revisions.size === 0
    )
      return;
    this.renewing = true;
    const rooms = [...this.revisions.keys()];
    try {
      const result = await this.pool.query(
        `UPDATE avaclash_relay_games SET lease_until=clock_timestamp()+interval '45 seconds'
         WHERE chain_id=$1 AND escrow_address=$2 AND lease_owner=$3
         AND room_id=ANY($4::bigint[]) AND result IS NULL AND lease_until>clock_timestamp()
         RETURNING room_id`,
        [this.chainId, this.escrow, this.owner, rooms],
      );
      // A room can finish/release while this query is queued; only still-owned rooms matter.
      const renewed = new Set(result.rows.map((row) => Number(row.room_id)));
      if (rooms.some((id) => this.revisions.has(id) && !renewed.has(id)))
        this.fail();
    } catch {
      this.fail();
    } finally {
      this.renewing = false;
    }
  }

  private async commit(
    roomId: number,
    active: ActiveGameState | null,
    terminal: SavedGameResult | null,
  ): Promise<void> {
    this.assertAvailable();
    const revision = this.revisions.get(roomId);
    if (revision === undefined)
      throw Error("Room lease is not held by this relay.");
    try {
      const result = await this.pool.query<{ revision: string }>(
        `UPDATE avaclash_relay_games SET active_state=$5::jsonb, result=$6::jsonb,
         revision=revision+1, updated_at=clock_timestamp(), lease_until=clock_timestamp()+interval '45 seconds'
         WHERE chain_id=$1 AND escrow_address=$2 AND room_id=$3 AND lease_owner=$4
         AND result IS NULL AND lease_until>clock_timestamp() AND revision=$7
         RETURNING revision::text`,
        [
          this.chainId,
          this.escrow,
          roomId,
          this.owner,
          active ? JSON.stringify(active) : null,
          terminal ? JSON.stringify(terminal) : null,
          revision,
        ],
      );
      if (!result.rows[0]) throw Error("Room lease or revision changed.");
      this.revisions.set(roomId, result.rows[0].revision);
      if (terminal) this.forget(roomId);
    } catch {
      this.fail();
      throw Error(
        "Could not durably save room; reconnect after relay restart.",
      );
    }
  }

  async saveActive(state: ActiveGameState): Promise<void> {
    await this.commit(state.roomId, state, null);
  }

  async saveResult(result: SavedGameResult): Promise<void> {
    // Retries (including an ambiguous COMMIT response) may only reuse the same result.
    const existing = (await this.read(result.roomId))?.result;
    if (existing) {
      const same =
        existing.outcome === result.outcome &&
        existing.reason === result.reason &&
        existing.winner.toLowerCase() === result.winner.toLowerCase() &&
        existing.whiteAddress?.toLowerCase() ===
          result.whiteAddress?.toLowerCase() &&
        existing.blackAddress?.toLowerCase() ===
          result.blackAddress?.toLowerCase() &&
        JSON.stringify(existing.moves) === JSON.stringify(result.moves);
      if (!same) throw Error("A different terminal result is already stored.");
      return;
    }
    await this.commit(result.roomId, null, result);
  }

  private forget(roomId: number): void {
    this.revisions.delete(roomId);
    if (this.revisions.size === 0 && this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
  }

  async release(roomId: number): Promise<void> {
    this.forget(roomId);
    await this.pool.query(
      `UPDATE avaclash_relay_games SET lease_owner=NULL, lease_until=clock_timestamp()
       WHERE chain_id=$1 AND escrow_address=$2 AND room_id=$3 AND lease_owner=$4`,
      [this.chainId, this.escrow, roomId, this.owner],
    );
  }

  async close(): Promise<void> {
    this.stopped = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    await Promise.allSettled(
      [...this.revisions.keys()].map((id) => this.release(id)),
    );
    await this.pool.end();
  }
}
