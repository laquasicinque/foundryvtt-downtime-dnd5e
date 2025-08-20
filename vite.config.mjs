import cleanPlugin from "vite-plugin-clean";
import { normalizePath } from "vite";
import path from "path";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// For convenience, you just need to modify the package ID below as it is used to fill in default proxy settings for
// the dev server.
const s_MODULE_ID = "downtime-dnd5e";
const s_PACKAGE_ID = "modules/" + s_MODULE_ID;
const s_ENTRY_JAVASCRIPT = "module.js";

const s_COMPRESS = false; // Set to true to compress the module bundle.
const s_SOURCEMAPS = true; // Generate sourcemaps for the bundle (recommended).

// ATTENTION!
// You must change `base` and the `proxy` strings replacing `/modules/${s_MODULE_ID}/` with your
// module or system ID.

export default () => {
    /** @type {import('vite').UserConfig} */
    return {
        root: "src/", // Source location / esbuild root.
        base: `/${s_PACKAGE_ID}/`, // Base module path that 30001 / served dev directory.
        publicDir: false, // No public resources to copy.
        cacheDir: "../.vite-cache", // Relative from root directory.

        resolve: { conditions: ["import", "browser"] },

        esbuild: {
            target: ["es2022", "chrome100"],
            keepNames: true, // Note: doesn't seem to work.
        },

        // About server options:
        // - Set to `open` to boolean `false` to not open a browser window automatically. This is useful if you set up a
        // debugger instance in your IDE and launch it with the URL: 'http://localhost:30001/game'.
        //
        // - The top proxy entry redirects requests under the module path for `style.css` and following standard static
        // directories: `assets`, `lang`, and `packs` and will pull those resources from the main Foundry / 30000 server.
        // This is necessary to reference the dev resources as the root is `/src` and there is no public / static
        // resources served with this particular Vite configuration. Modify the proxy rule as necessary for your
        // static resources / project.
        server: {
            port: 29999,
            open: "/game",
            strictPort: true, // Prevents switching to a different port if 29999 is unavailable
            // open: false,
            watch: {
                usePolling: true, // Ensures file changes are detected
            },
            proxy: {
                // Serves static files from main Foundry server.
                [`^(/${s_PACKAGE_ID}/(images|fonts|assets|lang|languages|packs|styles|templates|style.css))`]:
                    "http://127.0.0.1:30000",

                // All other paths besides package ID path are served from main Foundry server.
                [`^(?!/${s_PACKAGE_ID}/)`]: "http://127.0.0.1:30000",

                // Enable socket.io from main Foundry server.
                "/socket.io": { target: "ws://127.0.0.1:30000", ws: true },
            },
        },

        build: {
            outDir: normalizePath(path.resolve(__dirname, `./dist/${s_MODULE_ID}`)), // __dirname,
            emptyOutDir: false,
            sourcemap: s_SOURCEMAPS,
            brotliSize: true,
            minify: s_COMPRESS ? "terser" : false,
            target: ["es2022", "chrome100"],
            terserOptions: s_COMPRESS ? { ...terserConfig(), ecma: 2022 } : void 0,
            lib: {
                entry: path.resolve(__dirname, "./src/" + s_ENTRY_JAVASCRIPT), // "./module.js"
                formats: ["es"],
                fileName: "module",
            },
            rollupOptions: {
                external: ["pixi.js", "tidy5e-sheet"], // Prevent bundling PIXI.js
            },
        },

        // Necessary when using the dev server for top-level await usage inside of TRL.
        optimizeDeps: {
            esbuildOptions: {
                target: "es2022",
            },
        },

        plugins: [svelte({ configFile: "../svelte.config.ts" }), cleanPlugin()],
    };
};
