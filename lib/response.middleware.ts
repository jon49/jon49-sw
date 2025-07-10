import { isHtml } from "./utils.js"

const encoder = new TextEncoder()
function streamResponse(response: { body: Generator, headers?: any }): Response {
    let { body, headers } = response
    const stream = new ReadableStream({
        async start(controller: ReadableStreamDefaultController<any>) {
            try {
                for await (let x of body) {
                    if (typeof x === "string")
                        controller.enqueue(encoder.encode(x))
                }
                controller.close()
            } catch (error) {
                console.error(error)
            }
        }
    })

    return new Response(stream, {
        headers: {
            "content-type": "text/html; charset=utf-8",
            ...headers,
        }
    })
}

export function useResponse(_: Request, res: any, __: any) : void {
    if (isHtml(res.body)) {
        Object.assign(res, { response: streamResponse(res) })
        return
    }

    if (res.error) {
        Object.assign(res, {
            response: new Response(res.error, {
                status: 500,
                headers: {
                    "content-type": "text/plain; charset=utf-8",
                }
            })
        })
    }

    if (res.response) {
        return res.response
    }

    if (res.body) {
        Object.assign(res, {
            response: new Response(res.body, {
                status: res.status || 200,
                headers: {
                    "content-type": res.type || "text/plain; charset=utf-8",
                    ...res.headers,
                }
            })
        })
    }
}
