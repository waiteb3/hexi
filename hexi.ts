import { serve, ServerRequest } from 'https://deno.land/std@0.69.0/http/server.ts'
import {
    graphql,
    GraphQLSchema,
    buildSchema,
} from 'https://raw.githubusercontent.com/adelsz/graphql-deno/v15.0.0/mod.ts'

import { defaults, Ref } from './models.ts'
import { Registry } from './registry.ts'
import { AppTree, PluginHandler, HexiReply, HexiContext, HexiRequest, HandlerConfig } from './server.ts'
import { Router } from './router.ts'

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

const decoder = new TextDecoder()

export default class Hexi<C> {
    app: AppTree<C>
    router: Router<PluginHandler<any, any, any>>
    schema: GraphQLSchema
    registry: { [name: string]: Registry }
    resolvers: { [name: string]: (query: Ref) => Promise<any> }

    constructor(app: AppTree<C>) {
        this.app = app
        this.registry = {}
        this.resolvers = {}

        this.router = new Router({ handler: this.notFound })
        this.router.use('/auth', this.app.server.secrets.auth.router)

        this.router.get('/', { handler: this.graphiql })
        this.router.post('/', { handler: this.graphiql })

        this.router.get('/favicon.ico', { async handler() {
            return {
                body: 'todo',
                status: 500,
            }
        }})

        for (const name in defaults) {
            this.registry[name] = new Registry(name, defaults[name])
        }

        for (const name in app.objects) {
            // TODO always to lower things to discourage schenanigans?
            // TODO sanitize name
            this.registry[name] = new Registry(name, app.objects[name])
        }

        for (const name in this.registry) {
            console.log('Syncing schema for ' + name)
            const model = this.registry[name]
            model.syncStorage()
        }

        let schema = 'input Ref {\n\tid: ID!\n}\n\n'

        for (const name in this.registry) {
            schema += this.registry[name].getTypedef() + '\n\n'
        }

        schema += 'type Query {\n'
        for (const name in this.registry) {
            const queries = this.registry[name].getQueries()
            schema += queries ? queries.map(q => '\t' + q).join('\n') + '\n' : ''
        }
        schema += '}\n\n'

        schema += 'type Mutation {\n'
        for (const name in this.registry) {
            const queries = this.registry[name].getMutations()
            schema += queries ? queries.map(q => '\t' + q).join('\n') + '\n' : ''
        }
        schema += '}\n\n'

        console.log(schema)
        this.schema = buildSchema(schema)

        for (const name in this.registry) {
            if (name === 'Query' || name === 'Mutation') {
                continue
            }

            this.resolvers[`find${name}`] = async() => {
                return this.registry[name].listAll()
            }
            this.resolvers[`get${name}`] = async (query) => {
                return this.registry[name].get(query.id)
            }
            this.resolvers[`save${name}`] = async (params: any) => {
                const obj = 'id' in params ? await this.registry[name].get(params.id) : null
                delete params.id // TODO think this over more, may want to permit client side IDs + validator

                if (obj) {
                    return this.registry[name].update(obj, params)
                } else {
                    return this.registry[name].create(params)
                }
            }
        }
    }

    notFound = async(): Promise<HexiReply<string>> => {
        return {
            body: 'Not Found',
            http: {
                action: 'not-found'
            },
            type: 'html',
        }
    }

    graphiql = async(): Promise<HexiReply<string>> => {
        const index = await Deno.readTextFile('index.html')
        return {
            body: index,
            type: 'html',
        }
    }

    graphql = async(_: HexiContext, req: HexiRequest<{ query: string }>): Promise<HexiReply<any>> => {
        const obj = await graphql(this.schema, req.body.query, this.resolvers)
        return {
            body: obj,
        }
    }

    async authorize(request: ServerRequest, config?: HandlerConfig) {
        if (config && config.public) {
            return {
                id: '',
                kind: 'public',
                confirmed: false,
                permission: 'deny:organization:*',
            }
        }

        const token = request.headers.get('authorization')
        if (!token) {
            return null
        }

        const session = await this.registry.Session.find('token', token) as any | null
        if (!session) {
            return null
        }

        const rbac = await this.registry.OrganizationRoleBinding.get(session.account.id) as any
        if (!rbac) {
            return null
        }

        const account = await this.registry.Account.get(session.account.id) as any
        return {
            ...account,
            permission: `${rbac ? rbac.role : 'admin'}:organization:${rbac.organization.id}`,
        }
    }

    private async handle(request: ServerRequest) {
        const [path, query] = request.url.split('?', 2)
        const queryParams = new URLSearchParams(query || '')

        const methodName = request.method.toUpperCase()
        if (methodName != 'GET' &&
            methodName != 'PUT' &&
            methodName != 'POST' &&
            methodName != 'PATCH' &&
            methodName != 'DELETE') {
            request.respond({
                body: 'Method Not Allowed',
                status: 405,
            })
            return
        }

        // let ctx = await this.contextualizer({ /* TODO contextual logging */ })
        const ctx: HexiContext = {
            async logger(...args: any[]) {
                console.log(args)
            },
            registry: this.registry,
            config: {},
            account: undefined,
        }
        const requestID = Math.random().toString().split('.')[1]
        ctx.logger(`Request=${requestID} in context=${path + ':' + methodName}`)

        const bodyBytes = request.contentLength && request.contentLength > 0 ? await Deno.readAll(request.body) : null
        const bodyRaw = bodyBytes ? decoder.decode(bodyBytes) : null

        const requestedType = request.headers.get('content-type') || request.headers.get('accept')
        const body = bodyRaw && requestedType?.includes('application/json') ? JSON.parse(bodyRaw) : bodyRaw

        // TODO need to think through handling completeness but a failure in a post step
        const { handler, config } = this.router.match(path, methodName)

        ctx.account = await this.authorize(request, config)

        const reply = await handler(ctx, { body, params: queryParams })
        const headers = new Headers( [['X-Request-ID', requestID]] )

        let status = 200

        if (reply.http) switch (reply.http.action) {
            case 'redirect': {
                headers.append('Location', reply.http.url)
                status = 302
                break
            }
            case 'not-found': {
                status = 404
                break
            }
        }

        switch (reply.type) {
            default:
            case 'json': {
                headers.append('content-type', 'application/json')
                await request.respond({
                    body: JSON.stringify(reply.body),
                    status,
                    headers,
                })
                break
            }
            case 'html': {
                headers.append('content-type', 'text/html')
                await request.respond({
                    body: reply.body.toString(),
                    status,
                    headers,
                })
                break
            }
        }
    }

    async listen() {
        const server = serve(this.app.server.listen)
        const hostname = `http${'certFile' in this.app.server.listen ? 's' : ''}://${this.app.server.listen.hostname || '0.0.0.0'}:${this.app.server.listen.port}`

        banner(hostname)

        return {
            server,
            loop: Promise.resolve().then(async() => {
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
        }
    }
}
