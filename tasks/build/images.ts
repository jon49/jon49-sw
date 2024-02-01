import { cp, rm } from "node:fs/promises"
import { Glob } from "bun"
import { addHash, findHashedFile } from "./system"
import path from "node:path"

export async function handlImages(targetDirectory: string) {
    console.time("Images")
    let glob = new Glob(`**/*.{png,jpg,jpeg,svg,ico}`)
    let files: string[] = []
    for await (const file of glob.scan("./src")) {
        files.push(file)
    }

    await Promise.all(files.map(async file => {
        let parsed = path.parse(file)
        let hashed = await findHashedFile(file, parsed.ext, targetDirectory)
        if (hashed) {
            await rm(hashed)
        }
        let hashedFilename = await addHash(file)
        await cp(`./src/${file}`, `${targetDirectory}/${hashedFilename}`)
    }))
    console.timeEnd("Images")
}

