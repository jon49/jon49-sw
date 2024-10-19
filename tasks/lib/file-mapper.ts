import { rm } from "node:fs/promises"
import path from "node:path"

import { getHash, glob, write } from "./system.ts"

export interface FileMapper {
    url: string
    file: string
}

function isFileMapper(x: any | undefined): x is FileMapper {
    return x?.url && x?.file
}

let option: { isRunning: boolean, isWaiting: NodeJS.Timeout | null } = {
    isRunning: false,
    isWaiting: null
}

export async function fileMapper(targetDirectory: string, force = false) {
    if (option.isRunning || option.isWaiting || !force) {
        if (option.isWaiting) {
            clearTimeout(option.isWaiting)
        }
        option.isWaiting = setTimeout(() => {
            option.isWaiting = null
            fileMapper(targetDirectory, true)
        }, 30)
        return
    }
    try {
        option.isRunning = true
        console.time("File Mapper")

        let oldFileMapperFiles = await glob("**/file-map.*.js", targetDirectory)
        Promise.all(oldFileMapperFiles.map(async x => {
            await rm(`${targetDirectory}/${x}`)
        }))

        let files: string[] = await glob("**/*.{js,css,json,ico,svg,png}", targetDirectory)

        let mapper = files.map(x => {
            let parsed = path.parse(x)
            let parsed2 = path.parse(parsed.name)
            let url = `/${parsed.dir}/${parsed2.name}${parsed.ext}`
            let file = `/${x}`
            return {
                url,
                file,
            }
        })
        .filter(isFileMapper)

        // Write mapper to file in src/web/file-map.js
        if (option.isWaiting) return
        let fileMapContent = `(() => { self.app = { links: ${JSON.stringify(mapper)} } })()`
        let hash = getHash(fileMapContent)
        let fileMapUrl = `/web/file-map.${hash}.js`
        await write(`${targetDirectory}${fileMapUrl}`, fileMapContent)

        let globalFiles =
            mapper
            .filter(x => x.url.includes(".global."))
            .map(x => x.file)
            .join(`","`)

        let swFile = mapper.find(x => x.url === "/web/sw.js")?.file

        let globals = `${globalFiles && `"`}${globalFiles}${globalFiles && `",`}`
        // Create service worker central file
        if (option.isWaiting) return
        await write(
            `${targetDirectory}/web/sw.js`,
            `importScripts("${fileMapUrl}",${globals}"${swFile}")`)

    } catch (error) {
        console.error(error)
    } finally {
        option.isRunning = false
        console.timeEnd("File Mapper")
    }
}

