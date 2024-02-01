import { cp } from "node:fs/promises"
import { FileMapper } from "./file-mapper"
import { Glob, file, write } from "bun"

export async function handleHTML(targetDirectory: string, mappableFiles: FileMapper[]) {
    console.time("Copying HTML")
    await cp(
        "./node_modules/@jon49/sw/lib/app-loader.html",
        `${targetDirectory}/web/index.html`,
        { recursive: true }
    )

    let htmlGlob = new Glob("**/*.html")
    for await (const filename of htmlGlob.scan("./src")) {
        let fileBun = file(`./src/${filename}`)
        let text = await fileBun.text()
        for (let urlFile of mappableFiles) {
            text = text.replace(urlFile.url, urlFile.file)
        }

        await write(`${targetDirectory}/${filename}`, text)
    }
    console.timeEnd("Copying HTML")
}

