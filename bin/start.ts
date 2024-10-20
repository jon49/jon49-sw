import { cp, rm, mkdir } from "node:fs/promises"
import path from "node:path"

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
    console.log("  -h, --help                Help")
    process.exit(0)
}

let targetDirectory = argv.targetDirectory
let isProd = argv.isProd

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

const staticFileConfig = {
    entryPoints: [
        "./src/**/*.css",
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
    for (let i = 0; i < contexts.length; i++) {
        let ctx = contexts[i]
        if (i === 0) {
            ctx.serve({ port: argv.port, servedir: targetDirectory, host: "localhost" })
        } else {
            ctx.watch()
        }
    }
    console.timeEnd("Watching")
}

