// Deploys the hosted version (writestead.com). Self-hosters use `npm run deploy` instead.
//
//   node scripts/deploy-hosted.mjs            # with R2
//   node scripts/deploy-hosted.mjs --no-r2    # while R2 isn't enabled; uploads go to KV
//
// Hosted settings are passed here, not in wrangler.jsonc, because every self-hoster deploys that file.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "writestead.com";
// Fixed hostnames get Workers Custom Domains (DNS and SSL are created for them). Blogs made at
// signup reach the Worker through the wildcard route, which needs a proxied `*` DNS record.
const DOMAINS = [ROOT, `www.${ROOT}`, `demo.${ROOT}`, `blog.${ROOT}`];
const ROUTES = [`*.${ROOT}/*`];

const run = (command, args) =>
{
    execFileSync(command, args, { stdio: "inherit" });
};

run("npm", ["run", "build"]);

const configPath = "dist/writestead/wrangler.json";
if (process.argv.includes("--no-r2"))
{
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.r2_buckets = [];
    writeFileSync(configPath, JSON.stringify(config));
    console.log("Deploying without R2: uploads are stored in KV.");
}

run("npx", [
    "wrangler", "deploy", "-c", configPath,
    "--var", "MODE:multi", "--var", `ROOT_DOMAIN:${ROOT}`,
    ...DOMAINS.flatMap((domain) => ["--domain", domain]),
    ...ROUTES.flatMap((route) => ["--route", route]),
]);
