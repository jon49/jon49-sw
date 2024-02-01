import path from "node:path"
import { readdir, stat, rm, cp, exists } from "node:fs/promises"
import { Glob } from "bun"

export async function findHashedFile(
    filename: string,
    ext: string,
    targetDirectory: string) {
    if (!(await exists(`${targetDirectory}/${filename}`))) {
        return undefined
    }

    let parsed = path.parse(filename)
    let glob = new Glob(`**/${parsed.dir}/${parsed.name}.*${ext}`)
    for await (const file of glob.scan(targetDirectory)) {
        return `${targetDirectory}/${file}`
    }
}

export async function cpAll(fromTo: [string, string][]) {
    await Promise.all(fromTo.map(([from, to]) => cp(from, to)))
}

export async function rmAll(targetDirectory: string, glob: Glob, predicate: (file: string) => boolean = () => true) {
    let files: string[] = []
    if (await exists(targetDirectory)) {
        for await (const file of glob.scan(targetDirectory)) {
            if (predicate(file)) {
                files.push(file)
            }
        }
    }
    Promise.all(files.map(file => rm(`${targetDirectory}/${file}`)))
}

export async function addHash(filename: string) {
    let file = await Bun.file(`./src/${filename}`).arrayBuffer()
    let hash = Bun.hash(file).toString(16)
    let ext = path.extname(filename)

    return insertString(filename, `.${hash}`, -ext.length)
}

export function insertString(original: string, insert: string, index: number) {
    return original.slice(0, index) + insert + original.slice(index)
}

export async function getUpdateType(filename: string | Error | undefined) {
    if (filename == undefined || filename instanceof Error) {
        return UpdateType.OTHER
    }

    filename = `./src/${filename}`
    if (typeof filename === "string" && filename.endsWith("4913")) {
        // scan for latest updated file in directory, shallow
        let dir = filename.replace("4913", "")
        let filenames = await readdir(dir, { withFileTypes: true })
        let newestFile: { date: number, file: string } | undefined
        for (const file of filenames) {
            if (file.isFile()) {
                let fullFilename = `${dir}${file.name}`
                let stats = await stat(fullFilename)
                let date = stats.mtimeMs
                if (date > (newestFile?.date ?? 0)) {
                    newestFile = {
                        date,
                        file: fullFilename
                    }
                }
            }
        }
        filename = newestFile?.file ?? ""
    }
    console.log(`File changed: ${filename}`)
    return setUpdateType(filename)
}

function setUpdateType(filename: string) {
    switch (path.extname(filename)) {
        case ".css":
            return UpdateType.CSS
        case ".js":
        case ".ts":
            return UpdateType.JS
        case ".html":
            return UpdateType.HTML
        case ".json":
            return UpdateType.JSON
        default:
            return UpdateType.OTHER
    }
}

export enum UpdateType {
    CSS,
    JS,
    HTML,
    JSON,
    OTHER,
}

