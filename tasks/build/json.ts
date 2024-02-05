import { cp, rm } from "node:fs/promises"
import { Glob } from "bun"
import { addHash, findHashedFile } from "./system"

export async function initJson(targetDirectory: string) {
    const jsonGlob = new Glob("**/*.json")

    for await (const file of jsonGlob.scan("./src")) {
        handleJsonUpdate(file, targetDirectory)
    }
}

export async function handleJsonUpdate(filename: string, targetDirectory: string) {
    console.time("Copying JSON")
    let oldFile = await findHashedFile(filename, ".json", targetDirectory)
    if (oldFile) {
        await rm(oldFile)
    }

    let filenameWithHash = await addHash(filename)
    await cp(`./src/${filename}`, `${targetDirectory}/${filenameWithHash}`, {
        recursive: true,
    })
    console.timeEnd("Copying JSON")
}

