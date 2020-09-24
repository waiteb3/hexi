import { serve, ServerRequest, Response } from 'https://deno.land/std@0.69.0/http/server.ts'

import marshallers, { Reply, Marshaller } from './marshallers.ts'

type Middleware<C> = (context: Readonly<C>, request: Readonly<ServerRequest>) => Promise<C>

type Handler<C> = (context: Readonly<C>, request: Readonly<ServerRequest>) => Promise<Reply>

type Hook<C> = (context: Readonly<C>, request: Readonly<ServerRequest>, response: Readonly<Response>) => void

type EndpointType = 'json' | 'yaml' | 'toml'

interface CommonConfig<C> {
    type?: EndpointType
    middleware?: Middleware<C>[]
    hooks?: Hook<C>[]
}

interface Endpoint<C> {
    name?: string // TODO ensure unique
    middleware?: Middleware<C>[]
    handler: Handler<C>
    hooks?: Hook<C>[]
}

interface EndpointSet<C> {
    name?: string
    // TODO options
    get?: Endpoint<C>
    put?: Endpoint<C>
    post?: Endpoint<C>
    patch?: Endpoint<C>
    delete?: Endpoint<C>
}

type Importable = unknown

interface EndpointTree<C> {
    common: CommonConfig<C>
    readonly routes: { [path: string]: EndpointSet<C> }
}

type Contextualizer<C> = (ctx: Partial<C>) => Promise<C>

function banner(hostname: string) {
    const banner = `⬡ ⬢ Listening on ${hostname} ⬢ ⬡`
    const padding = ' '.repeat((banner.length - '██   ██ ███████ ██   ██ ██'.length) / 2)
    const hexi = [
        '██   ██ ███████ ██   ██ ██',
        '██   ██ ██       ██ ██  ██',
        '███████ █████     ███   ██',
        '██   ██ ██       ██ ██  ██',
        '██   ██ ███████ ██   ██ ██',
    ]
    for (const h of hexi) {
        console.log(padding + h)
    }
    console.log()
    console.log(banner)
}

export default class Hexi<C> {
    contextualizer: Contextualizer<C>
    app: EndpointTree<C>
    marshaller: Marshaller

    constructor(contextualizer: Contextualizer<C>, app: EndpointTree<C>) {
        this.contextualizer = contextualizer
        this.app = app
        this.marshaller = marshallers[app.common.type || 'json']
    }

    private async handle(request: ServerRequest) {
        const methodName = request.method.toLowerCase()
        if (methodName != 'get' &&
            methodName != 'put' &&
            methodName != 'post' &&
            methodName != 'patch' &&
            methodName != 'delete') {
            request.respond({
                body: 'Method Not Allowed',
                status: 405,
            })
            return
        }

        const route = this.app.routes[request.url]
        if (!route || !(methodName in route)) {
            request.respond({
                body: 'Not Found',
                status: 404,
            })
            return
        }

        const method = route[methodName]
        if (!method) {
            request.respond({
                body: 'Not Found',
                status: 404,
            })
            return
        }

        const requestID = Math.random().toString().split('.')[1]
        const name = `${route.name || request.url}:${method.name || methodName}`
        console.log(`Request=${requestID} in context=${name}`)

        let ctx = await this.contextualizer({ /* TODO contextual logging */ })

        if (this.app.common.middleware) {
            for (const middleware of this.app.common.middleware) {
                ctx = await middleware(ctx, request)
            }
        }

        if (method.middleware) {
            for (const middleware of method.middleware) {
                ctx = await middleware(ctx, request)
            }
        }

        const reply = await method.handler(ctx, request)

        const response = {
            ...this.marshaller.marshall(reply),
            status: reply.status,
        }

        if (method.hooks) {
            for (const hook of method.hooks) {
                await hook(ctx, request, response)
            }
        }

        if (this.app.common.hooks) {
            for (const hook of this.app.common.hooks) {
                await hook(ctx, request, response)
            }
        }

        // TODO need to think through handling completeness but a failure in a post step
        await request.respond(response)
    }

    async listen(options: Deno.ListenOptions | Deno.ListenTlsOptions = { hostname: 'localhost', port: 80 }) {
        const server = serve(options)
        const hostname = `http${'certFile' in options ? 's' : ''}://${options.hostname || '0.0.0.0'}:${options.port}`

        banner(hostname)

        Promise.resolve().then(async() => {
            for await (const request of server) {
                try {
                    await this.handle(request)
                } catch(err) {
                    // TODO if HexiError return msg & code
                    console.log(err)
                    request.respond({
                        body: 'Internal Server Error',
                        status: 500,
                    })
                }
            }
        })
        return server
    }
}
