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

    filename = `./src/${filename}`
    let filenameWithHash = await addHash(filename)
    console.log("Copying", filename, "to", filenameWithHash.replace("src", targetDirectory))
    await cp(filename, filenameWithHash.replace("src", targetDirectory), {
        recursive: true,
    })
    console.timeEnd("Copying JSON")
}

