import { SwResponse } from "./sw-framework.js"
import { isHtml } from "./utils.js"

let { links, globalDb } =
    // @ts-ignore
    self.app as { links: { file: string, url: string }[], html: Function, db: any, globalDb: any }

if (!links) {
    console.error("Expecting links defined with `self.app.links`, but found none.")
}

function redirect(req: Request) {
    return Response.redirect(req.referrer, 303)
}

const searchParamsHandler = {
    get(obj: any, prop: string) {
        if (prop === "_url") {
            return obj
        }
        return obj.searchParams.get(prop)
    }
}

function searchParams<TReturn>(url: URL): TReturn & { _url: URL } {
    return new Proxy(url, searchParamsHandler)
}

interface ResponseOptions {
    handleErrors?: Function
}

export let options: ResponseOptions = {}

// @ts-ignore
export async function useRoutes(req: Request, res: SwResponse, ctx: any): Promise<void> {
    try {
        const url = normalizeUrl(req.url)
        if (!url.pathname.startsWith("/web/")) {
            res.response = await fetch(req)
        } else {
            Object.assign(res, await executeHandler({ url, req, ctx }))
        }
    } catch (error) {
        console.error("Get Response Error", error)
        res.error = "Oops something happened which shouldn't have!"
    }
}

function call(fn: Function | undefined, args: any) {
    return fn instanceof Function && fn(args)
}

const methodTypes = ['get', 'post'] as const
type MethodTypes = typeof methodTypes[number] | null

function isMethod(method: unknown) {
    if (typeof method === "string" && methodTypes.includes(<any>method)) {
        return method as MethodTypes
    }
    return null
}

let cache = new Map<string, any>()
export async function findRoute(url: URL, method: unknown) {
    let validMethod: MethodTypes = isMethod(method)
    if (validMethod) {
        // @ts-ignore
        if (!self.app?.routes) {
            console.error("Expecting routes defined with `self.app.routes`, but found none.")
            return null
        }
        // @ts-ignore
        for (const r of self.app.routes) {
            // @ts-ignore
            if (r.file
                && (r.route instanceof RegExp && r.route.test(url.pathname)
                    || (r.route instanceof Function && r.route(url)))) {
                let file = links?.find(x => x.url === r.file)?.file
                // Load file
                if (!file) {
                    console.error(`"${r.file}" not found in links!`)
                    return null
                }
                if (!cache.has(file)) {
                    let cachedResponse = await cacheResponse(file)
                    if (!cacheResponse) {
                        console.error(`"${file}" not found in cache!`)
                        return null
                    }
                    let text = await cachedResponse.text()
                    let func = new Function(text)()
                    cache.set(file, func)
                }

                let routeDef = cache.get(file)
                if (routeDef[validMethod]) {
                    return routeDef[validMethod]
                }
            }

            if (r[validMethod]
                && (r.route instanceof RegExp && r.route.test(url.pathname)
                    || (r.route instanceof Function && r.route(url)))) {
                return r[validMethod]
            }
        }
    }
    return null
}

interface ExectuteHandlerOptions {
    url: URL
    req: Request
    ctx: any
}
async function executeHandler({ url, req, ctx }: ExectuteHandlerOptions): Promise<SwResponse> {
    let method = req.method.toLowerCase()
    let isPost = method === "post"
    if (!isPost) {
        if (!url.pathname.endsWith("/")) {
            return { response: await cacheResponse(url.pathname, req) }
        }

        if (url.searchParams.get("login") === "success") {
            await globalDb.setLoggedIn(true)
        }
    }

    let handlers =
        <RouteHandler<RouteGetArgs | RoutePostArgs> | null>
        await findRoute(url, method)

    // @ts-ignore
    if (handlers) {
        try {
            let messages: string[] = []
            const data = await getData(req)
            let query = searchParams<{ handler?: string }>(url)
            let args = { req, data, query }
            let result = await (
                handlers instanceof Function
                    ? handlers(args)
                    : (call(handlers[query.handler ?? ""], args)
                        || call(handlers[method], args)
                        || Promise.reject("I'm sorry, I didn't understand where to route your request.")))

            if (!result) {
                return isPost
                    ? { response: redirect(req) }
                    : { error: "Not found!" }
            }

            if (isPost && result.message == null) {
                messages.push("Saved!")
            }

            if (result.message?.length > 0) {
                messages.push(result.message)
            } else if (result.messages?.length > 0) {
                messages.push(...result.messages)
            }
            ctx.messages = messages
            ctx.events = result.events

            if (isHtml(result)) {
                return {
                    body: result,
                }
            }

            if (isHtml(result.body)) {
                return { 
                    ...result,
                    type: "text/html",
                }
            } else {
                if ("json" in result) {
                    result.body = JSON.stringify(result.json)
                    result.headers = {
                        ...result.headers,
                    }
                }
                return {
                    ...result,
                    type: "application/json"
                }
            }

        } catch (error) {
            console.error(`"${method}" error:`, error, "\nURL:", url);
            if (isPost) {
                return { error: "An error occurred while processing your request." }
            } else {
                return { error: "Not found!" }
            }
        }
    }

    return { error: "Not Found!" }
}

async function getData(req: Request) {
    let o: any = {}
    if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData()
        for (let [key, val] of formData.entries()) {
            if (key.endsWith("[]")) {
                key = key.slice(0, -2)
                if (key in o) {
                    o[key].push(val)
                } else {
                    o[key] = [val]
                }
            } else {
                o[key] = val
            }
        }
    } else if (req.headers.get("Content-Type")?.includes("json")) {
        o = await req.json()
    }
    return o
}

/**
*  /my/url -> /my/url/
*  /my/script.js -> /my/script.js
*/
function normalizeUrl(url: string): URL {
    let uri = new URL(url)
    let path = uri.pathname
    !uri.pathname.endsWith("/") && (uri.pathname = isFile(path) ? path : path + "/")
    return uri
}

function isFile(s: string) {
    return s.lastIndexOf("/") < s.lastIndexOf(".")
}

async function cacheResponse(url: string, req?: Request | undefined): Promise<Response> {
    url = links?.find(x => x.url === url)?.file || url
    const match = await caches.match(url)
    if (match) return match
    const res = await fetch(req || url)
    if (!res || res.status !== 200 || res.type !== "basic") return res
    const responseToCache = res.clone()
    // @ts-ignore
    let version: string = self.app?.version
        ?? (console.warn("The version number is not available, expected glboal value `self.app.version`."), "")
    const cache = await caches.open(version)
    cache.put(url, responseToCache)
    return res
}

export interface RouteGetArgs {
    req: Request
    query: any
}

export interface RoutePostArgs {
    query: any
    data: any
    req: Request
}

export interface RouteObjectReturn {
    body?: string | AsyncGenerator | null
    status?: number
    headers?: any
    events?: any
    message?: string
    messages?: string[]
    json?: any
}

export interface RouteHandler<T> {
    (options: T): Promise<
        AsyncGenerator
        | Response
        | RouteObjectReturn
        | undefined
        | null
        | void>
}

export interface RoutePostHandler {
    [handler: string]: RouteHandler<RoutePostArgs>
}

export interface RouteGetHandler {
    [handler: string]: RouteHandler<RouteGetArgs>
}

interface Route_ {
    route: RegExp | ((a: URL) => boolean)
    file?: string
    get?: RouteHandler<RouteGetArgs> | RouteGetHandler
    post?: RouteHandler<RoutePostArgs> | RoutePostHandler
}

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
    Pick<T, Exclude<keyof T, Keys>>
    & {
        [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
    }[Keys]

export type Route = RequireAtLeastOne<Route_, "file" | "get" | "post">
export type RoutePage = Pick<Route_, "get" | "post">

