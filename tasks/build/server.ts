interface ServeOptions {
    targetDirectory: string
}

export function server({ targetDirectory }: ServeOptions) {
    console.log("Starting Server at http://localhost:3000")
    Bun.serve({
        port: 3000,
        async fetch(req) {
            console.log(req.url)
            let url = new URL(req.url)
            let filePath = targetDirectory + url.pathname
            if (filePath.endsWith("/")) {
                filePath = filePath.slice(0, -1)
            }
            let file =
                isFile(filePath)
                    ? Bun.file(filePath)
                : Bun.file(`${filePath}/index.html`)
            return new Response(file)
        },
        error() {
            return new Response(null, { status: 404 })
        }
    })
}

function isFile(file: string) {
    let segements = file.split("/")
    return segements[segements.length - 1].includes(".")
}

