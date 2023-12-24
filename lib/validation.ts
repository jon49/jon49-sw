export async function reject(s: string | string[]) {
    return Promise.reject(s)
}

interface Value<T> {
    value: T
}
interface String_ extends Value<string> {
}
export interface String100 extends String_ {}
export interface String50 extends String_ {}
export type TableType = string
export interface IDType<T extends TableType> extends Value<number> { 
    _id: T
}

const notFalsey = async (error: string, val: string | undefined) =>
    !val ? reject(error) : val

const maxLength = async (error: string, val: string, maxLength: number) =>
    (val.length > maxLength)
        ? reject(error)
    : val

const createString = async (name: string, maxLength_: number, val?: string | undefined) => {
    const trimmed = await notFalsey(`"${name}" is required.`, val?.trim())
    const s = await maxLength(`'${name}' must be less than ${maxLength_} characters.`, trimmed, maxLength_)
    return <string>s
}

function isInteger(val: number) {
    try {
        BigInt(val)
        return true
    } catch(e) {
        return false
    }
}

export async function createNumber(name: string, val: number | string) : Promise<number> {
    let num = +val
    if (isNaN(num)) {
        return reject(`'${name}' was expecting a number but was given ${val}`)
    }
    return num
}

export function createPositiveNumber(name: string) {
    return async function (val: number | string | undefined | null) {
        if (val == null) return reject(`'${name}' is required.`)
        let num = await createNumber(name, val)
        if (num < 0) return reject(`'${name}' must be 0 or greater. But was given '${val}'.`)
        return num
    }
}

export function createPositiveWholeNumber(name: string) : (val: number | string | undefined | null) => Promise<number> {
    return async (val: number | string | undefined | null) => {
        let num = await createPositiveNumber(name)(val)
        if (!isInteger(num)) return reject(`${name} must be a whole number. But was given '${num}' and was expecting '${num|0}'.`)
        return num
    }
}

export function createArrayOf<S, T>(fn: (val: S) => Promise<T>) : (val: S[]) => Promise<T[]> {
    return async (values: S[]) => {
        let result = Promise.all(values.map(fn))
        return result
    }
}

export function createIdNumber(name: string) : (val: number | string) => Promise<number> {
    return async (val: number | string) => {
        let wholeNumber = await createPositiveWholeNumber(name)(val)
        if (wholeNumber < 1) return reject(`'${name}' must be 1 or greater. But was given '${val}'.`)
        return wholeNumber
    }
}

export const maybe =
    <T, S>(f: (val: T) => Promise<S>) =>
    (val: T | undefined | null) =>
        !val ? Promise.resolve(val) : f(val)

export const createDateString =
    (name: string) =>
    (val: string | undefined) : Promise<string> =>
        /\d{4}-[01]\d-[0123]\d/.test(val ?? "")
            ? Promise.resolve(<string>val)
        : reject(`'${name}' must be a valid date string. But was given '${val}'.`)

export const createTimeString =
    (name: string) =>
    (val: string | undefined) : Promise<string> =>
        /\d{2}:\d{2}/.test(val ?? "")
            ? Promise.resolve(<string>val)
        : reject(`'${name}' must be a valid time string. But was given '${val}'.`)

export const createDateTimeString =
    (name: string) =>
    (val: string | undefined) : Promise<string> => {
        if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val ?? "")) {
            return Promise.resolve(<string>val)
        }
        return reject(`'${name}' must be a valid date time string. But was given '${val}'.`)
    }

export const createString25 =
    (name: string) =>
    (val: string | undefined) =>
        createString(name, 25, val)

export const createString50 =
    (name: string) =>
    (val: string | undefined) =>
        createString(name, 50, val)

export const createStringInfinity =
    (name: string) =>
    (val: string | undefined) =>
        createString(name, Infinity, val)

export function createCheckbox(val: string | undefined) {
    return Promise.resolve(val === "on")
}

type Nullable<T> = T | undefined | null
export async function required<T>(o: Nullable<T>, message: string): Promise<T> {
    if (!o) return reject(message)
    return o
}

class Assert {
    isFalse(value: boolean, message: string) {
        return !value ? Promise.resolve() : reject(message)
    }
    isTrue(value: boolean, message: string) {
        return this.isFalse(!value, message)
    }
}
export const assert = new Assert()


