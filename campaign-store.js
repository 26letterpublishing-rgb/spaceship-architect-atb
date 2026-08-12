const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const LOCAL_DATA_DIR = process.env.SA_LOCAL_DATA_DIR
  ? path.resolve(process.env.SA_LOCAL_DATA_DIR)
  : path.join(__dirname, "data");
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, "campaigns.json");
const LOCAL_EPOCH_FILE = path.join(LOCAL_DATA_DIR, "campaign-epoch.txt");
const DATA_EPOCH = "2026-08-11-fresh-start-1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class CampaignStore {
  constructor() {
    this.pool = null;
    this.local = new Map();
    this.writeQueue = Promise.resolve();
    this.mode = process.env.DATABASE_URL ? "postgres" : "local-file";
  }

  async init() {
    if (this.mode === "postgres") {
      const useSsl = process.env.DATABASE_SSL !== "false"
        && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "");
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: 5,
      });
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sa_campaigns (
          code VARCHAR(4) PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sa_campaign_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      const epoch = await this.pool.query("SELECT value FROM sa_campaign_meta WHERE key = 'data_epoch'");
      if (epoch.rows[0]?.value !== DATA_EPOCH) {
        await this.pool.query("BEGIN");
        try {
          await this.pool.query("DELETE FROM sa_campaigns");
          await this.pool.query(
            "INSERT INTO sa_campaign_meta (key, value) VALUES ('data_epoch', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            [DATA_EPOCH],
          );
          await this.pool.query("COMMIT");
        } catch (error) {
          await this.pool.query("ROLLBACK");
          throw error;
        }
      }
      return;
    }

    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    let localEpoch = "";
    try {
      localEpoch = fs.readFileSync(LOCAL_EPOCH_FILE, "utf8").trim();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (localEpoch !== DATA_EPOCH) {
      fs.writeFileSync(LOCAL_DATA_FILE, "[]", "utf8");
      fs.writeFileSync(LOCAL_EPOCH_FILE, DATA_EPOCH, "utf8");
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, "utf8"));
      for (const campaign of Array.isArray(parsed) ? parsed : []) {
        if (campaign?.code) this.local.set(campaign.code, campaign);
      }
    } catch (error) {
      if (error.code !== "ENOENT") console.warn("Campaign file could not be read; starting with an empty local store.", error.message);
    }
  }

  async get(code) {
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized) return null;
    if (this.pool) {
      const result = await this.pool.query("SELECT payload FROM sa_campaigns WHERE code = $1", [normalized]);
      return result.rows[0]?.payload ? clone(result.rows[0].payload) : null;
    }
    return this.local.has(normalized) ? clone(this.local.get(normalized)) : null;
  }

  async findByName(name) {
    const normalized = String(name || "").trim().toLocaleLowerCase();
    if (!normalized) return [];
    if (this.pool) {
      const result = await this.pool.query(
        "SELECT payload FROM sa_campaigns WHERE LOWER(BTRIM(payload->>'name')) = $1",
        [normalized],
      );
      return result.rows.map((row) => clone(row.payload));
    }
    return [...this.local.values()]
      .filter((campaign) => String(campaign?.name || "").trim().toLocaleLowerCase() === normalized)
      .map(clone);
  }

  async create(campaign) {
    if (this.pool) {
      try {
        await this.pool.query(
          "INSERT INTO sa_campaigns (code, payload, updated_at) VALUES ($1, $2::jsonb, NOW())",
          [campaign.code, JSON.stringify(campaign)],
        );
        return true;
      } catch (error) {
        if (error.code === "23505") return false;
        throw error;
      }
    }
    if (this.local.has(campaign.code)) return false;
    this.local.set(campaign.code, clone(campaign));
    await this.flushLocal();
    return true;
  }

  async save(campaign) {
    campaign.updatedAt = new Date().toISOString();
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO sa_campaigns (code, payload, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (code) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
        [campaign.code, JSON.stringify(campaign)],
      );
      return;
    }
    this.local.set(campaign.code, clone(campaign));
    await this.flushLocal();
  }

  async delete(code) {
    const normalized = String(code || "").trim().toUpperCase();
    if (this.pool) {
      const result = await this.pool.query("DELETE FROM sa_campaigns WHERE code = $1", [normalized]);
      return result.rowCount > 0;
    }
    const removed = this.local.delete(normalized);
    if (removed) await this.flushLocal();
    return removed;
  }

  async flushLocal() {
    const payload = JSON.stringify([...this.local.values()], null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${LOCAL_DATA_FILE}.tmp`;
      await fs.promises.writeFile(temporary, payload, "utf8");
      await fs.promises.rename(temporary, LOCAL_DATA_FILE);
    });
    return this.writeQueue;
  }

  async close() {
    await this.writeQueue;
    if (this.pool) await this.pool.end();
  }
}

module.exports = { CampaignStore };
