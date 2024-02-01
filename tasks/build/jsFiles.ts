import { Glob, file, write } from "bun"
import { rmAll } from "./system"
import path from "node:path"

function getBuildType(filename: string) {
    let basename = path.basename(filename)
    let shouldBundle =
        [".bundle.", ".page.", "sw.", ".global."]
        .some(x => basename.includes(x))
    let isStatic = filename.startsWith("js/") || filename.includes("/js/") && !basename.startsWith("_")
    let ignore = !shouldBundle && !isStatic
    return ignore
        ? "ignore"
    : shouldBundle
        ? "bundle"
    : "static"
}

export async function buildJS(isProd: boolean, targetDirectory: string) {
    console.time("Building JS")
    // Remove old files
    let jsGlob = new Glob("**/*.js")
    await rmAll(targetDirectory, jsGlob)

    let bundleFiles: string[] = []
    let staticFiles: string[] = []
    for await (const file of new Glob("**/*.{js,ts}").scan("./src")) {
        switch (getBuildType(file)) {
            case "ignore":
                break
            case "bundle":
                bundleFiles.push(`./src/${file}`)
                break
            case "static":
                staticFiles.push(`./src/${file}`)
                break
            default:
                throw new Error(`Unknown build type for ${file}`)
        }
    }

    if (bundleFiles.length) {
        await Bun.build({
            entrypoints: bundleFiles,
            outdir: targetDirectory,
            minify: isProd,
            format: "esm",
            naming: "[dir]/[name].[hash].[ext]",
            root: "./src",
            target: "browser",
        })
    }

    if (staticFiles.length) {
        await Bun.build({
            entrypoints: staticFiles,
            outdir: targetDirectory,
            minify: isProd,
            format: "esm",
            naming: "[dir]/[name].[hash].[ext]",
            root: "./src",
            target: "browser",
            external: ["*"],
        })
    }

    // Change export default to return
    for await (const page of new Glob("**/*\\.page.*.js").scan(targetDirectory)) {
        let bunFile = file(`${targetDirectory}/${page}`)
        let content = await bunFile.text()
        let matched = content.match(/,(\S*)=(\S*);export/)
        if (matched) {
            let [, name, value] = matched
            content = content.replace(`,${name}=${value}`, "")
            content = content.replace(
                `export{${name} as default}`,
                `return ${value}`)
        } else {
            let matched = content.match(/var (\S*) = (\S*);\sexport \{\s.*\s.*/)
            if (!matched) {
                continue
            }
            content = content.replace(matched[0], `return ${matched[2]};`)
        }
        await write(bunFile, content)
    }

    console.timeEnd("Building JS")
}

