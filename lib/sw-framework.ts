class SWFramework {
    private middlewares: Middleware[];    

    constructor() {
        this.middlewares = [];
    }

    use(middleware: Middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        this.middlewares.push(middleware);
    }

    async start(fetchEvent: FetchEvent) : Promise<Response> {
        let ctx = {} // Context object to pass to middlewares
        let res: SwResponse = {}
        let req = fetchEvent.request
        for (let middleware of this.middlewares) {
            let result = middleware(req, res, ctx)
            if (result instanceof Promise) {
                result = await result;
            }
            if (result === false) {
                // Stop processing middlewares if one returns false
                break;
            }
        }
        return res.response ?? new Response(res.error || "Not Found", {
            status: res.status || 404,
            headers: {
                "content-type": res.type || "text/plain; charset=utf-8",
                ...res.headers,
            }
        })
    }
}

export let swFramework = new SWFramework();

export type SwResponse = {
    status?: number
    headers?: { [key: string]: string }
    response?: Response
    error?: string
} & (
    | { body?: never; type?: never }
    | { body: any; type: "text/plain" | "application/json" | "text/html" | "application/xml" }
);

interface Middleware {
    (req: Request, res: SwResponse, ctx: any): void | Promise<void | false> | false
}
