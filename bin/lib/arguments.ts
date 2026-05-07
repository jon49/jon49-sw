import argvGenerator from "minimist"

export class Arguments {
    argv: Argv
    constructor() {
        this.argv = argvGenerator(process.argv.slice(2)) as Argv
    }
    get _() {
        return this.argv._
    }
    get environment() {
        return this.argv.e || this.argv.env || "dev"
    }
    get port() {
        return this.argv.p || this.argv.port || 3000
    }
    get targetDirectory() {
        return this.argv.t || this.argv.target || "./public"
    }
    /**
     * Reverse-proxy mappings of the form `<path-prefix>=<upstream>`, e.g.
     * `--proxy=/api=http://localhost:4000`. May be passed multiple times.
     * Returns [{ prefix, target }] pairs.
     */
    get proxies(): { prefix: string, target: string }[] {
        let raw = this.argv.proxy
        if (raw == null) return []
        let list = Array.isArray(raw) ? raw : [raw]
        return list
            .map(s => String(s))
            .map(s => {
                let i = s.indexOf("=")
                if (i < 0) {
                    throw new Error(`--proxy must be <prefix>=<upstream>, got "${s}"`)
                }
                return { prefix: s.slice(0, i), target: s.slice(i + 1) }
            })
    }
    get help() {
        return this.argv.h || this.argv.help
    }
    get isHelp() {
        return this.help
    }
    get isProd() {
        return this.environment === "prod"
    }
    get isServer() {
        return this.environment === "server"
    }
}

export interface Argv {
    _: string[]
    // Environment
    e: "dev" | "server" | "prod"
    env: "dev" | "server" | "prod"
    // Port
    p: number
    port: number
    // Target directory
    t: string
    target: string
    // Proxy: repeatable "<prefix>=<upstream>"
    proxy?: string | string[]
    // Help
    h: boolean
    help: boolean
}

