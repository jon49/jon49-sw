import { get, getMany, setMany, set as set1, update as update1, clear } from "idb-keyval"

const _updated =
    async (key: IDBValidKey) => {
        await update1("updated", (val?: Updated) => {
            if (Array.isArray(key)) {
                key = JSON.stringify(key)
            }

            // If key is not string or number then make it a string.
            if (typeof key !== "string" && typeof key !== "number") {
                key = key.toString()
            }

            return (val || new Set).add(key)
        })
    }

export interface DBSet<DBAccessors extends any> {
    <K extends keyof DBAccessors>(key: K, value: DBAccessors[K], sync?: boolean): Promise<void>
    <T>(key: string, value: T, sync?: boolean): Promise<void>
    (key: string | any[], value: any, sync?: boolean): Promise<void>
}
const set: DBSet<any> =
async function(key: any, value: any, sync = true) {
    if (sync && "_rev" in value) {
        if ("_rev" in value) {
            await _updated(key)
        } else {
            return Promise.reject(`Revision number not specified! For "${key}".`)
        }
    }
    await set1(key, value)
    return
}

export interface DBUpdate<DBAccessors extends any> {
    <K extends keyof DBAccessors>(key: K, f: (val: DBAccessors[K]) => DBAccessors[K], options?: { sync: boolean }): Promise<void>
    <T>(key: string, f: (val: T) => T, options?: { sync: boolean }): Promise<void>
    (key: string, f: (v: any) => any, options?: { sync: boolean }): Promise<void>
}

const update: DBUpdate<any> =
async function update(key: any, f: any, options = { sync: true }) {
    await update1(key, f)
    if (options.sync) {
        let o: any = await get<any>(key)
        if (o && "_rev" in o) {
            await _updated(key)
        } else {
            Promise.reject(`Revision number not found for "${key}".`)
        }
    }
}

export { update, set, get, getMany, setMany, clear }

export interface DBGet<DBAccessors extends any> {
    <K extends keyof DBAccessors>(key: K): Promise<DBAccessors[K] | undefined>
    <T>(key: string): Promise<T | undefined>
}

export type Updated = Set<IDBValidKey>

export interface Revision { _rev: number }

export type FormReturn<T> = { [key in keyof T]: string|undefined }

export type Theme = "light" | "dark" | "system"
