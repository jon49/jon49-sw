import path from "node:path"
import { Glob, write } from "bun"

export async function getHTMLMappableFiles(mappers: FileMapper[]) {
    return mappers.filter(x =>
          x.url.endsWith(".css")
          || x.url.includes("/js/")
          || x.url.includes("/images/"))
}

export interface FileMapper {
    url: string
    file: string
}

function isFileMapper(x: any | undefined): x is FileMapper {
    return x?.url && x?.file
}

export async function fileMapper(targetDirectory: string): Promise<FileMapper[]> {
    console.time("File Mapper")
    const glob = new Glob("**/*.{js,css,json,ico,svg,png}")
    let files: string[] = []
    for await (const file of glob.scan(targetDirectory)) {
        files.push(file)
    }

    let mapper = files.map(x => {
        let parsed = path.parse(x)
        let parsed2 = path.parse(parsed.name)
        let url = `/${parsed.dir}/${parsed2.name}${parsed.ext}`
        let file = `/${x}`
        if (file === "/web/sw.js") return
        return {
            url,
            file,
        }
    })
    .filter(isFileMapper)

    // Write mapper to file in src/web/file-map.js
    let fileMapContent = `self.app = { links: ${JSON.stringify(mapper)} }`
    let hash = Bun.hash(fileMapContent).toString(16)
    await write(`${targetDirectory}/web/file-map.${hash}.js`, fileMapContent)

    console.timeEnd("File Mapper")

    return mapper
}

