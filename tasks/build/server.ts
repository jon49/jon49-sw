interface ServeOptions {
    targetDirectory: string
}

export function server({ targetDirectory }: ServeOptions) {
    console.log("Starting Server at http://localhost:3000")
    Bun.serve({
        port: 3000,
        async fetch(req) {
            console.log(req.url)
            const filePath = targetDirectory + new URL(req.url).pathname
            const file = Bun.file(filePath)
            return new Response(file)
        },
        error() {
            return new Response(null, { status: 404 })
        }
    })
}

