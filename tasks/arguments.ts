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
    get help() {
        return this.argv.h || this.argv.help
    }
    get isHelp() {
        return this.help
    }
    get isProd() {
        return this.environment === "prod"
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
    // Help
    h: boolean
    help: boolean
}

