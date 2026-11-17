// Every SQL file in migrations/, bundled into the Worker at build time.
const files = import.meta.glob<string>("../../../migrations/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
});

const migrations = Object.entries(files)
    .map(([path, sql]) => ({ name: path.split("/").pop()!.replace(/\.sql$/, ""), sql }))
    .sort((a, b) => a.name.localeCompare(b.name));

let ready: Promise<void> | undefined;

// Applies pending migrations once per isolate. The Deploy to Cloudflare button only builds and
// deploys, so the Worker sets up its own schema instead of relying on a CLI step.
export function ensureSchema(db: D1Database): Promise<void>
{
    ready ??= applyMigrations(db).catch((error) =>
    {
        ready = undefined;
        throw error;
    });
    return ready;
}

async function applyMigrations(db: D1Database)
{
    await db.prepare(
        "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)"
    ).run();
    const { results } = await db.prepare("SELECT name FROM _migrations").all<{ name: string }>();
    const applied = new Set(results.map((row) => row.name));

    for (const migration of migrations)
    {
        if (applied.has(migration.name))
        {
            continue;
        }
        const statements = splitStatements(migration.sql).map((sql) => db.prepare(sql));
        statements.push(
            db.prepare("INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (?, ?)")
                .bind(migration.name, Math.floor(Date.now() / 1000))
        );
        // A batch runs as one transaction, so a migration is applied fully or not at all.
        await db.batch(statements);
    }
}

export function splitStatements(sql: string): string[]
{
    return sql
        .replace(/^\s*--.*$/gm, "")
        .split(/;\s*(?:\n|$)/)
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0);
}
