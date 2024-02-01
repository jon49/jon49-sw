import { Glob, write, file } from "bun"

export async function handleSw(targetDirectory: string) {
    console.time("Building SW")

    let swHashedFile = ""
    for await (const x of new Glob("**/sw.*.js").scan(targetDirectory)) {
        swHashedFile = x
        makeIife(x, targetDirectory)
    }

    let fileMapperHashedFile = ""
    for await (const x of new Glob("**/file-map.*.js").scan(targetDirectory)) {
        fileMapperHashedFile = x
        makeIife(x, targetDirectory)
    }

    let globals: string[] = []
    for await (const x of new Glob("**/*\\.global.*.js").scan(targetDirectory)) {
        globals.push(x)
        makeIife(x, targetDirectory)
    }

    await write(
        `${targetDirectory}/web/sw.js`,
        `importScripts("/${fileMapperHashedFile}",${globals.map(x => `"/${x}"`).join(",")},"/${swHashedFile}")`)

    console.timeEnd("Building SW")
}

async function makeIife(filename: string, targetDirectory: string) {
    let bunFile = file(`${targetDirectory}/${filename}`)
    let content = await bunFile.text()
    if (!content.startsWith("(() => {")) {
        await write(bunFile, `(() => {\n${content}\n})()`)
    }
}

