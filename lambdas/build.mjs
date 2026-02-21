import { build } from "esbuild";
import { readdirSync } from "fs";

const handlers = readdirSync("src/handlers")
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `src/handlers/${f}`);

await build({
    entryPoints: handlers,
    bundle: true,
    platform: "node",
    target: "node20",
    outdir: "dist",
    outbase: "src",
    format: "cjs",
    sourcemap: true,
    // AWS SDK v3 is provided by the Lambda runtime — exclude to reduce bundle size
    external: [
        "@aws-sdk/*",
    ],
});

console.log(`✅ Bundled ${handlers.length} handlers`);
