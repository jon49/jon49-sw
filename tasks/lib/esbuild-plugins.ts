import path from "node:path"
import { cp, readFile, writeFile } from "node:fs/promises"

import type { BuildResult, PluginBuild } from "esbuild"

import { findHashedFile, glob, makeUrlPath, write } from "./system.ts"
import { fileMapper } from "./file-mapper.ts"

export function transformExportToReturn(targetDirectory: string) {
    return {
        name: 'transform-export-to-return',
        setup(build: PluginBuild) {
            build.onEnd(async result => {
                if (result.errors.length !== 0) {
                    return
                }
                await setPagesToReturn(targetDirectory)
            })
        },
    }
}

async function setPagesToReturn(targetDirectory: string) {
    let files = await glob("**/*.js", targetDirectory)
    await Promise.all(files.map(async (file: string) => {
        let filename = path.join(targetDirectory, file)
        let content = await readFile(filename, "utf-8")
        let matched = content.match(/,(\w*)=(\w*);export/)
        if (matched) {
            let [, name, value] = matched
            content = content.replace(`,${name}=${value}`, "")
            content = content.replace(
                `export{${name} as default}`,
                `return ${value}`)
        } else {
            let matched = content.match(/var (\w*) = (\w*);\sexport \{\s.*\s.*/)
            if (!matched) {
                return
            }
            content = content.replace(matched[0], `return ${matched[2]};`)
        }
        await writeFile(filename, content, 'utf-8')
    }))
}

export function updateFileMapper(targetDirectory: string) {
    return {
        name: 'update-file-mapper',
        setup(build: PluginBuild) {
            build.onEnd(async (result: BuildResult) => {
                if (result.errors.length !== 0) {
                    return
                }
                await fileMapper(targetDirectory)
            })
        },
    }
}

export function updateHTML(targetDirectory: string) {
    return {
        name: 'update-html-files',
        setup(build: PluginBuild) {
            build.onEnd(async result => {
                if (result.errors.length !== 0) {
                    return
                }
                await handleHTML(targetDirectory)
            })
        },
    }
}

async function handleHTML(targetDirectory: string) {
    console.time("Copying HTML")
    await cp(
        "./node_modules/@jon49/sw/lib/app-loader.html",
        `${targetDirectory}/web/index.html`,
        { recursive: true }
    )

    let files = await glob("**/*.html", "./src")

    let mappableFiles =
        (await Promise.all(
        (await glob("**/{css,js,images}/*.*", "./src"))
        .map(async x => {
            let ext = path.extname(x)
            if (ext === ".ts") {
                ext = ".js"
            }
            let hashedFile = await findHashedFile(x, ext, targetDirectory)
            if (!hashedFile) {
                return
            }
            return {
                url: makeUrlPath(x),
                file: makeUrlPath(hashedFile),
            }
        })))
        .filter(x => x) as { url: string, file: string }[]

    await Promise.all(files.map(async (filename: string) => {
        let content = await readFile(`./src/${filename}`, "utf-8")
        for (let mappableFile of mappableFiles) {
            content = content.replace(mappableFile.url, mappableFile.file)
        }

        await write(`${targetDirectory}/${filename}`, content)
    }))

    console.timeEnd("Copying HTML")
}

