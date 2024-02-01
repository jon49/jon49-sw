import { cp, rm } from "node:fs/promises"
import { Glob } from "bun"
import { addHash, findHashedFile } from "./system"

export async function initCss(targetDirectory: string) {
    console.time("Initializing CSS")
    const cssGlob = new Glob("**/*.css")

    let cssFiles: string[] = []
    for await (const file of cssGlob.scan("./src")) {
        cssFiles.push(file)
    }
    await Promise.all(cssFiles.map(file => handleCssUpdate(file, targetDirectory)))
    console.timeEnd("Initializing CSS")
}

export async function handleCssUpdate(filename: string, targetDirectory: string) {
    let oldFile = await findHashedFile(filename, ".css", targetDirectory)
    if (oldFile) {
        await rm(oldFile)
    }

    let from = `./src/${filename}`
    let to = `${targetDirectory}/${await addHash(filename)}`
    await cp(from, to, { recursive: true })
}

