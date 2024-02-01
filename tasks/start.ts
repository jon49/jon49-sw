import { rm } from "node:fs/promises"
import { watch } from "fs"
import { server } from "./build/server.ts"
import { UpdateType, getUpdateType } from "./build/system.ts"
import { handleCssUpdate, initCss } from "./build/css.ts"
import { buildJS } from "./build/jsFiles.ts"
import { handleHTML } from "./build/html.ts"
import { handleJsonUpdate, initJson } from "./build/json.ts"
import { fileMapper, getHTMLMappableFiles } from "./build/file-mapper.ts"
import { handleSw } from "./build/sw.ts"
import { handlImages } from "./build/images.ts"

// prod, dev, or server
const build = process.argv[2] ?? "dev"

let targetDirectory =
    build === "server"
        ? "../exercise-server/public"
    : "./public"

const isProd = build === "prod"

console.time("Cleaning")
await rm(targetDirectory, { recursive: true, force: true })
console.timeEnd("Cleaning")

console.time("Initializing")
await initCss(targetDirectory)
await buildJS(isProd, targetDirectory)
await initJson(targetDirectory)
await handlImages(targetDirectory)

let mapper = await fileMapper(targetDirectory)
let mappable = await getHTMLMappableFiles(mapper)
await handleHTML(targetDirectory, mappable)
await handleSw(targetDirectory)
console.timeEnd("Initializing")

const srcWatcher = watch(
    `./src`,
    { recursive: true },
    async (_, filename) => {
        if (filename === "web/file-map.ts") {
            return
        }
        let updateType = await getUpdateType(filename)
        switch (updateType) {
            case UpdateType.JS:
                await buildJS(isProd, targetDirectory)
                break
            case UpdateType.CSS:
                // Get Hex Hash of CSS File and Copy to Public
                handleCssUpdate(<string>filename, targetDirectory)
                break
            case UpdateType.HTML:
                // Copy HTML File to Public
                // Just do that once. I can restart the server if I need to.
                break
            case UpdateType.JSON:
                handleJsonUpdate(<string>filename, targetDirectory)
                break
            case UpdateType.OTHER:
                // Do nothing
        }

        await fileMapper(targetDirectory)
        await handleSw(targetDirectory)
    }
)

if (build === "dev") {
    server({ targetDirectory })
}

process.on("SIGINT", () => {
    srcWatcher.close();
    process.exit(0);
});

