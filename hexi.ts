import { serve, ServerRequest, Response } from 'https://deno.land/std@0.69.0/http/server.ts'

type Middleware<C> = (context: Readonly<C>, request: Readonly<ServerRequest>) => Promise<C>

type Reply = {
    status?: number
    response: any
}

type Handler<C> = (context: Readonly<C>, request: Readonly<ServerRequest>) => Promise<Reply>

interface CommonConfig<C> {
    middleware?: Middleware<C>[]
}

interface Endpoint<C> {
    middleware?: Middleware<C>[]
    handler: Handler<C>
    type?: 'json'
}

interface EndpointSet<C> {
    get?: Endpoint<C>
    post?: Endpoint<C>
    delete?: Endpoint<C>
}

type Importable = unknown

interface EndpointTree<C> {
    common: CommonConfig<C>
    readonly routes: { [name: string]: EndpointSet<C> }
}

type Contextualizer<C> = (ctx: Partial<C>) => Promise<C>

export default class Hexi<C> {
    contextualizer: Contextualizer<C>
    app: EndpointTree<C>

    constructor(contextualizer: Contextualizer<C>, app: EndpointTree<C>) {
        this.contextualizer = contextualizer
        this.app = app
    }

    async listen(options: Deno.ListenOptions | Deno.ListenTlsOptions = { hostname: 'localhost', port: 8000 }) {
        const s = serve(options)
        console.log(`http${'certFile' in options ? 's' : ''}://${options.hostname || '0.0.0.0'}:${options.port}`)

        for await (const req of s) {
            const route = this.app.routes['Root']
            let ctx = await this.contextualizer({})

            let err: Error | null = null
            
            const methodName = req.method.toLowerCase() as keyof EndpointSet<C>
            if (!(methodName in route)) {
                req.respond({
                    body: 'Not Found',
                    status: 404,
                })
                continue
            }

            const method = route[methodName]
            if (!method) {
                req.respond({
                    body: 'Not Found',
                    status: 404,
                })
                continue
            }

            if (this.app.common.middleware) {
                for (const middleware of this.app.common.middleware) {
                    ctx = await middleware(ctx, req)
                }        
            }

            if (method.middleware) {
                for (const middleware of method.middleware) {
                    ctx = await middleware(ctx, req)
                }
            }

            const reply = await method.handler(ctx, req)

            let body
            const headers = new Headers([])
            switch (method.type) {
                case 'json':
                case undefined:
                case null:
                    headers.append('content-type', 'application/json')
                    body = JSON.stringify(reply.response)
                    break
                default:
                    headers.append('content-type', method.type)
            }

            const fullResponse: Response = {
                body: body,
                headers,
            }

            console.log(fullResponse)

            await req.respond(fullResponse)
        }
    }
}