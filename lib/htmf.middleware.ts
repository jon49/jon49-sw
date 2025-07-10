import { SwResponse } from "./sw-framework.js"

function isHtmf(req: Request) {
    return req.headers.has("HF-Request")
}

function htmfHeader(events: any = {}, messages: string[] = []) : Record<string, string> {
    let userMessages =
        messages?.length > 0
            ? { "user-messages": messages }
            : null
    return {
        "hf-events": JSON.stringify({
            ...userMessages,
            ...(events || {})
        }) ?? "{}"
    }
}

export function useHtmf(req: Request, res: SwResponse, ctx: any): void {
    if (!isHtmf(req)) return

    let messages = ctx.messages || []
    if (res.error) {
        messages.push(res.error)
        res.error = undefined
    }

    let headers = htmfHeader(ctx.events, ctx.messages)

    Object.assign(res, {
        headers: {
            ...res.headers,
            ...headers,
        }
    })
}
