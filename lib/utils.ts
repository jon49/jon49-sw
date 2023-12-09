export function when<S, T>(b: S | undefined, s: (a: S) => T): T | undefined
export function when<T>(b: any, s: T): T | undefined
export function when(b: any, s: any) {
    return b
        ? (s instanceof Function && s.length ? s(b) : s)
    : typeof s === "string"
        ? ""
    : undefined
}

export class DbCache {
    #cache: Map<string, any>
    constructor() {
        this.#cache = new Map()
    }

    async get<T>(key: string, fn: () => Promise<T>): Promise<T> {
        if (this.#cache.has(key)) {
            return this.#cache.get(key)
        }
        let value = await fn()
        this.#cache.set(key, value)
        return value
    }
}

