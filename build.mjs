import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const browsers = ['chrome', 'firefox'];

async function build() {
    for (const browser of browsers) {
        const srcDir = `bringyoursub-${browser}`;
        const outDir = `bringyoursub-${browser}/dist`;

        console.log(`Building for ${browser}...`);

        // Clean dist
        if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
        fs.mkdirSync(outDir, { recursive: true });

        // Copy static assets
        const copyRecursive = (src, dest) => {
            if (fs.lstatSync(src).isDirectory()) {
                if (!fs.existsSync(dest)) fs.mkdirSync(dest);
                for (const child of fs.readdirSync(src)) {
                    copyRecursive(path.join(src, child), path.join(dest, child));
                }
            } else {
                fs.copyFileSync(src, dest);
            }
        };

        // Copy manifest, icons, html, css
        if (fs.existsSync(`${srcDir}/manifest.json`)) fs.copyFileSync(`${srcDir}/manifest.json`, `${outDir}/manifest.json`);
        if (fs.existsSync(`${srcDir}/icons`)) copyRecursive(`${srcDir}/icons`, `${outDir}/icons`);
        if (fs.existsSync(`${srcDir}/extension/popup/popup.html`)) {
            // Create subdirectory structure in dist
            fs.mkdirSync(`${outDir}/extension/popup`, { recursive: true });
            fs.copyFileSync(`${srcDir}/extension/popup/popup.html`, `${outDir}/extension/popup/popup.html`);
            fs.copyFileSync(`${srcDir}/extension/popup/popup.css`, `${outDir}/extension/popup/popup.css`);
        }

        // specific entry points
        const entryPoints = [
            `${srcDir}/extension/background/ai.ts`,
            `${srcDir}/extension/content/youtube.ts`,
            `${srcDir}/extension/popup/popup.ts`
        ];

        // Filter existing entry points (in case file naming varies)
        const validEntryPoints = entryPoints.filter(p => fs.existsSync(p));

        await esbuild.build({
            entryPoints: validEntryPoints,
            bundle: true,
            outdir: outDir, // preserve directory structure relative to common ancestor? No, esbuild flattens if not careful.
            // We want: dist/extension/background/ai.js
            // We can use outbase to preserve structure
            outbase: srcDir,
            format: 'esm', // or iife for browser
            // For content scripts and background workers, iife is safer usually, but service worker (chrome) supports modules.
            // Firefox background script (non-module) needs iife or separate handling.
            // Let's use 'iife' generally for compatibility unless it's a module worker.
            // Chrome MV3 background IS a module.
            // Content scripts are usually loaded as files.
            // Let's stick to 'esm' for Chrome Service Worker, and bundle manually if needed?
            // Actually, for broad compatibility, 'iife' is safest for content scripts.
            // But 'ai.ts' (background) uses `import`.
            // Let's use a dual strategy or just standard bundle.
            // Simpler: Just bundle everything to standard JS.
            target: ['chrome100', 'firefox100'],
            minify: false,
            sourcemap: true,
            external: ['chrome', 'browser'] // implicitly external
        });
    }
    console.log("Build complete.");
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});
