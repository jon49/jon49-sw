import { cp, rm, mkdir } from "node:fs/promises"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import http from "node:http"

import esbuild from "esbuild"

import { transformExportToReturn, updateFileMapper, updateHTML } from "./lib/esbuild-plugins.ts"
import { addHash, glob } from "./lib/system.ts"
import { Arguments } from "./lib/arguments.ts"

let argv = new Arguments()

if (argv.isHelp) {
    console.log("Usage: node --experimental-strip-types start.ts [options]")
    console.log("Options:")
    console.log("  -e, --env, --environment  Environment (dev, server, prod)")
    console.log("  -p, --port                Port (default: 3000)")
    console.log("  -t, --target              Target directory (default: ./public)")
    console.log("      --proxy               Reverse proxy mapping <prefix>=<upstream>,")
    console.log("                            e.g. --proxy=/api=http://localhost:4000.")
    console.log("                            May be passed multiple times.")
    console.log("  -h, --help                Help")
    process.exit(0)
}

let targetDirectory = argv.targetDirectory
let isProd = argv.isProd
let isServer = argv.isServer

console.time("Cleaning")
await rm(targetDirectory, { recursive: true, force: true })
console.timeEnd("Cleaning")

console.time("Copying Files")
await mkdir(targetDirectory, { recursive: true })
let filesToCopy = await glob("**/*.{ico,png,svg,json}", "./src")
let copyFiles = await glob("**/*.min.*", "./src")
filesToCopy.push(...copyFiles)
let hashedFiles = await Promise.all(filesToCopy.map(x => addHash(x)))
await Promise.all(filesToCopy.map((filename, i) => {
    let source = path.join("src", filename)
    let target = path.join(targetDirectory, hashedFiles[i])
    return cp(source, target, { recursive: true })
}))
console.timeEnd("Copying Files")

// Bundled modules
const bundleConfig = {
    entryPoints: [
        "./src/**/*.bundle.ts",
    ],
    entryNames: "[dir]/[name].[hash]",
    bundle: true,
    format: "esm",
    minify: isProd,
    outbase: "src",
    outdir: targetDirectory,
    plugins: [
        updateFileMapper(targetDirectory),
    ],
    target: "es2023",
    // logLevel: "debug",
}

// IIFEs
const iifeConfig = {
    entryPoints: [
        "./src/**/*.global.ts",
        "./src/web/sw.ts",
    ],
    entryNames: "[dir]/[name].[hash]",
    bundle: true,
    format: "iife",
    minify: isProd,
    outbase: "src",
    outdir: targetDirectory,
    plugins: [
        updateFileMapper(targetDirectory),
    ],
    target: "es2023",
    // logLevel: "debug",
}

// Static JS files
let staticFiles = await glob("**/js/*.{js,ts}", "./src")
let isStaticFile = /.*\/[0-9a-zA-Z\-]+.[jt]s/
let staticEntryPoints =
        staticFiles
            .filter(x =>
                    isStaticFile.test(x)
                    && !x.includes(".bundle.")
                    && !x.includes(".min.")
                    && !x.includes("sw.ts"))
            .map(x => `./src/${x}`)

// CSS files except already-minified ones (those are passed through by the
// copy step above with a SHA-1 hash; routing them through esbuild a second
// time produces a duplicate output with a different hash).
let cssFiles = await glob("**/*.css", "./src")
let cssEntryPoints = cssFiles
    .filter(x => !x.includes(".min."))
    .map(x => `./src/${x}`)

const staticFileConfig = {
    entryPoints: [
        ...cssEntryPoints,
        ...staticEntryPoints,
    ],
    entryNames: "[dir]/[name].[hash]",
    bundle: true,
    format: "esm",
    minify: isProd,
    outbase: "src",
    outdir: targetDirectory,
    plugins: [
        updateHTML(targetDirectory),
        updateFileMapper(targetDirectory),
    ],
    target: "es2023",
    external: ["*"],
}

// Pages
const pagesConfig = {
    entryPoints: [
        "./src/**/*.page.ts",
    ],
    entryNames: "[dir]/[name].[hash]",
    bundle: true,
    format: "esm",
    minify: isProd,
    outbase: "src",
    outdir: targetDirectory,
    plugins: [
        transformExportToReturn(targetDirectory),
        updateFileMapper(targetDirectory),
    ],
    target: "es2023",
}

const configs = [
    bundleConfig,
    iifeConfig,
    staticFileConfig,
    pagesConfig,
]

if (isProd) {
    console.time("Building")
    // @ts-ignore
    await Promise.all(configs.map(x => esbuild.build(x)))
    console.timeEnd("Building")
} else {
    console.time("Watching")
    // @ts-ignore
    let contexts = await Promise.all(configs.map(x => esbuild.context(x)))
    let proxies = argv.proxies
    for (let i = 0; i < contexts.length; i++) {
        let ctx = contexts[i]
        if (i === 0 && !isServer) {
            if (proxies.length > 0) {
                // esbuild on an internal port; user-facing server in front
                // forwards proxied prefixes and tunnels everything else to esbuild.
                let esbuildResult = await ctx.serve({ port: 0, servedir: targetDirectory, host: "127.0.0.1" })
                let esbuildHost = esbuildResult.hosts[0] ?? "127.0.0.1"
                startProxyServer({
                    listenPort: argv.port,
                    proxies,
                    esbuild: { host: esbuildHost, port: esbuildResult.port },
                    targetDirectory,
                })
            } else {
                ctx.serve({ port: argv.port, servedir: targetDirectory, host: "localhost" })
                console.log(`###### Serving on http://localhost:${argv.port} ######`)
            }
        } else {
            ctx.watch()
        }
    }
    console.timeEnd("Watching")
}

interface ProxyServerOptions {
    listenPort: number
    proxies: { prefix: string, target: string }[]
    esbuild: { host: string, port: number }
    targetDirectory: string
}

/**
 * Reads the latest `web/file-map.*.js` from the build output and parses out
 * the `links` array into a Map<unhashedUrl, hashedFile>. Used by the dev
 * proxy to rewrite requests like `/web/css/pico.min.css` to the actual built
 * file, mirroring what the service worker's dev middleware does at runtime.
 *
 * Why this exists: pages outside the SW scope (e.g. /login) bypass the SW
 * entirely, so any CSS @import or sub-resource referencing an unhashed
 * `/web/*` path 404s on first paint. The proxy fills that gap in dev. In
 * production the same problem must be solved at the front-end server (e.g.
 * NGINX `try_files $uri $uri.* =404;`).
 */
function loadFileMap(targetDirectory: string): Map<string, string> {
    let webDir = path.join(targetDirectory, "web")
    let map = new Map<string, string>()
    if (!existsSync(webDir)) return map
    let fileMapName = readdirSync(webDir).find(f => /^file-map\..*\.js$/.test(f))
    if (!fileMapName) return map
    let content
    try { content = readFileSync(path.join(webDir, fileMapName), "utf-8") }
    catch { return map }
    let m = content.match(/links:\s*(\[[\s\S]*?\])\s*\}\s*\}/)
    if (!m) return map
    let links: { url: string, file: string }[]
    try { links = JSON.parse(m[1]) }
    catch { return map }
    // Skip any entry whose unhashed URL has a real file on disk. The on-disk
    // file is what the browser must see, even if the file-map also lists the
    // URL pointing at a hashed equivalent. The motivating case is /web/sw.js:
    // the file-mapper emits an importScripts stub at the unhashed path AND
    // (depending on build timing) a file-map entry pointing at the bundled
    // sw.HASH.js. The browser registers /web/sw.js as the service worker; if
    // we serve the bundled file in its place, importScripts never runs and
    // self.sw stays undefined.
    for (let { url, file } of links) {
        let onDisk = path.join(targetDirectory, url.replace(/^\//, ""))
        if (existsSync(onDisk)) continue
        if (!map.has(url)) map.set(url, file)
    }
    return map
}

function startProxyServer({ listenPort, proxies, esbuild, targetDirectory }: ProxyServerOptions) {
    let parsedProxies = proxies.map(p => ({ prefix: p.prefix, url: new URL(p.target) }))

    // The file-map filename and its contents change on every esbuild rebuild.
    // We reload on every cache miss instead of relying on fs.watch (which on
    // Linux doesn't fire reliably for esbuild's atomic file replaces, and
    // misses the case where targetDirectory/web doesn't exist yet at startup).
    let fileMap = loadFileMap(targetDirectory)
    function lookup(pathOnly: string): string | undefined {
        let mapped = fileMap.get(pathOnly)
        if (mapped) return mapped
        // Miss — file-map may have been rebuilt with a new hash. Reload once
        // and try again. If still missing, give up (the request will be
        // forwarded as-is and 404 from esbuild).
        fileMap = loadFileMap(targetDirectory)
        return fileMap.get(pathOnly)
    }

    let server = http.createServer((req, res) => {
        let urlPath = req.url ?? "/"
        let match = parsedProxies.find(p => urlPath === p.prefix || urlPath.startsWith(p.prefix + "/") || urlPath.startsWith(p.prefix + "?"))

        if (!match) {
            // Rewrite an unhashed /web/* path to its hashed equivalent before
            // handing off to esbuild's serve.
            let qIdx = urlPath.indexOf("?")
            let pathOnly = qIdx < 0 ? urlPath : urlPath.slice(0, qIdx)
            let mapped = lookup(pathOnly)
            if (mapped) {
                req.url = qIdx < 0 ? mapped : mapped + urlPath.slice(qIdx)
            }
        }

        let upstream = match
            ? { host: match.url.hostname, port: Number(match.url.port || (match.url.protocol === "https:" ? 443 : 80)), preserveHost: false }
            : { host: esbuild.host, port: esbuild.port, preserveHost: true }

        let headers = { ...req.headers }
        if (!upstream.preserveHost) {
            headers.host = `${upstream.host}:${upstream.port}`
        }

        let proxied = http.request(
            {
                host: upstream.host,
                port: upstream.port,
                method: req.method,
                path: req.url,
                headers,
            },
            upRes => {
                res.writeHead(upRes.statusCode ?? 502, upRes.headers)
                upRes.pipe(res)
            }
        )
        proxied.on("error", err => {
            console.error(`Proxy error for ${req.method} ${req.url}:`, err.message)
            if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" })
            res.end("Bad gateway")
        })
        req.pipe(proxied)
    })
    server.listen(listenPort, "127.0.0.1", () => {
        console.log(`###### Serving on http://localhost:${listenPort} ######`)
        for (let p of proxies) {
            console.log(`  proxy: ${p.prefix} -> ${p.target}`)
        }
    })
}

