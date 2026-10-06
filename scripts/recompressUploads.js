/**
 * recompressUploads.js
 * ───────────────────────────────────────────────────────────────
 * One-time (safe to re-run) optimizer for locally-stored media. Re-encodes every
 * image in public/uploads at a lower webp quality so existing assets shrink the
 * same way new uploads now do (~50-69% smaller, no visible loss). The actual
 * work lives in lib/recompressUploads.js so the same logic can also run via
 * POST /api/cron/recompress-uploads on hosts without shell access.
 *
 * ALWAYS dry-run first to preview, then run for real (optionally with --backup):
 *   node scripts/recompressUploads.js --dry-run
 *   node scripts/recompressUploads.js --backup
 *
 * Flags:
 *   --dry-run            report what would change, write nothing
 *   --quality=80         webp/jpeg quality (1-100), default 80
 *   --min-savings=5      skip rewrite unless the new file is >= this % smaller
 *   --max-width=0        if > 0, also downscale images wider than this (px)
 *   --backup             copy each original to <file>.orig before overwriting
 * ───────────────────────────────────────────────────────────────
 */
import { recompressUploads } from "../lib/recompressUploads.js";

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const val = (name, def) => {
  const hit = args.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.split("=")[1] : def;
};

const opts = {
  dryRun: has("--dry-run"),
  backup: has("--backup"),
  quality: Number(val("--quality", "80")),
  minSavings: Number(val("--min-savings", "5")),
  maxWidth: Number(val("--max-width", "0")),
  log: (line) => console.log(line),
};

console.log("── recompressUploads ─────────────────────────────");
console.log(`quality     : ${opts.quality}`);
console.log(`min-savings : ${opts.minSavings}%`);
console.log(`max-width   : ${opts.maxWidth || "(no resize)"}`);
console.log(`backup      : ${opts.backup ? "yes (.orig copies)" : "no"}`);
console.log(`mode        : ${opts.dryRun ? "DRY-RUN (no writes)" : "LIVE (will overwrite)"}`);
console.log("──────────────────────────────────────────────────");

recompressUploads(opts)
  .then((s) => {
    console.log("──────────────────────────────────────────────────");
    console.log(`root               : ${s.root}`);
    console.log(`images scanned     : ${s.scanned}`);
    console.log(`${s.dryRun ? "would rewrite" : "rewritten    "}      : ${s.rewritten}`);
    console.log(`skipped (small)    : ${s.skippedSmall}`);
    console.log(`skipped (non-image): ${s.skippedNonImage}`);
    console.log(`failed             : ${s.failed}`);
    console.log(
      `size ${s.dryRun ? "would go" : "went    "}     : ${(s.beforeBytes / 1048576).toFixed(
        2,
      )} MB → ${(s.afterBytes / 1048576).toFixed(2)} MB  (saved ${(
        s.savedBytes / 1048576
      ).toFixed(2)} MB)`,
    );
    if (s.dryRun) {
      console.log("\nDry-run only — nothing changed. Re-run without --dry-run to apply.");
    } else if (s.backup) {
      console.log(
        "\nOriginals saved as <file>.orig. Once you've verified the site, delete them:",
      );
      console.log(`  find "${s.root}" -name '*.orig' -delete`);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
