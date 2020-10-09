import { serve, ServerRequest, Response } from 'https://deno.land/std@0.69.0/http/server.ts'
import {
    graphql,
    GraphQLSchema,
    buildSchema,
} from 'https://raw.githubusercontent.com/adelsz/graphql-deno/v15.0.0/mod.ts'

import { defaults, Ref } from './models.ts'
import { Registry } from './registry.ts'
import { AppTree, Reply } from "./server.ts"
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

function fetchJSON<T=any>(url: string | Request | URL, init?: RequestInit) {
    return fetch(url, init).then(async (res) => {
        if (res.ok) {
            return {
                data: await res.json() as T,
                response: res,
            }
        }
        throw new Error(await res.text())
    })
}

export default class Hexi<C> {
    app: AppTree<C>
    schema: GraphQLSchema
    registry: { [name: string]: Registry }
    resolvers: { [name: string]: (query: Ref) => Promise<any> }

    constructor(app: AppTree<C>) {
        this.app = app
        this.registry = {}
        this.resolvers = {}

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

    async graphiql(): Promise<Reply<string>> {
        const index = await Deno.readTextFile('index.html')
        return {
            body: index,
            status: 200,
            type: 'html',
        }
    }

    async graphql(query: any): Promise<Reply<any>> {
        const obj = await graphql(this.schema, query, this.resolvers)
        return {
            body: obj,
            status: 200,
        }
    }

    private async handle(request: ServerRequest) {
        const [path, query] = request.url.split('?', 2)
        const queryParams = new URLSearchParams(query || '')

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

        if (methodName === 'get' && path === '/') {
            const reply = await this.graphiql()
            await request.respond(reply)
            return
        }

        if (path === '/auth/github/install') {
            const installation_id = queryParams.get('installation_id')
            if (!installation_id) {
                return request.respond({
                    status: 500,
                    body: 'Missing installation_id',
                })    
            }

            const install = await fetchJSON(`https://api.github.com/app/installations/${installation_id}`, {
                headers: {
                    'Authorization': `Bearer ${this.app.server.secrets.auth.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            })

            console.log(install.data)

            const current = await this.registry.Organization.find('remote_id', install.data.id)
            if (current) {
                return request.respond({
                    status: 200,
                    body: 'Already Registered',
                })
            }

            await this.registry.Organization.create({ kind: 'github', remote_id: install.data.id, name: install.data.account.login })
            return request.respond({
                status: 200,
                body: 'Registered',
            })
        }

        // TODO event recorder
        if (path === '/auth/github/events') {
            const rawBody = await Deno.readAll(request.body)
            const decoder = new TextDecoder()
            const rawJSON = decoder.decode(rawBody)
            console.log(path, rawJSON)
            const queryRaw = JSON.parse(rawJSON)
            console.log(queryRaw)
            console.log(queryParams?.toString())
            return request.respond({
                status: 200,
                body: 'ok',
            })
        }

        if (path === `/auth/github/login`) {
            const url = `https://github.com/login/oauth/authorize?client_id=${this.app.server.secrets.auth.client_id}`
            console.log("Sending to github", url)
            await request.respond({
                body: `Redirecting to OAuth Login Page for Github at ${url}`,
                headers: new Headers([ ['Location', url] ]),
                status: 302,
            })
            return
        }

        // TODO encapsulate & generify & routing
        // TODO use state field for anti forgery
        // TODO create account & go to org form via invite code
        if (path === '/auth/github/callback') {
            const body = [
                [ 'client_id', this.app.server.secrets.auth.client_id ],
                [ 'client_secret', this.app.server.secrets.auth.client_secret ],
                [ 'code', queryParams.get('code') || '' ],
            ]
            console.log(path)
            console.log(queryParams.toString(), body)

            const query = new URLSearchParams(body)
            const url = `https://github.com/login/oauth/access_token?${query.toString()}`
            console.log(url)
            type GHAccess = {
                access_token: string
            }
            const authorization = await fetchJSON<GHAccess>(url, {
                 method: 'POST',
                 headers: { 'accept': 'application/json' }
            })

            // TODO anonymiser that print keys and shasum
            console.log(authorization.data)
            console.log(Array.from(authorization.response.headers.entries()))

            // curl https://api.github.com/user -H 'accept: application/json' -H 'authorization: token
            const user = await fetchJSON('https://api.github.com/user', {
                headers: { 'authorization': `token ${authorization.data.access_token}`}
            })
            console.log(user.data)
            console.log(Array.from(user.response.headers.entries()))

            const root = `http://localhost:8000/?token=${authorization.data.access_token}`
            console.log(root)

            await request.respond({
                body: `Redirecting to root`,
                headers: new Headers([ ['Location', root] ]),
                status: 302,
            })
            return
        }

        if (path === '/favicon.ico') {
            // console.log('/favicon.ico is TODO')
            await request.respond({
                body: 'todo',
                status: 500,
            })
            return
        }

        const rawBody = await Deno.readAll(request.body)
        const decoder = new TextDecoder()
        const rawJSON = decoder.decode(rawBody)
        console.log(path, rawJSON)
        const queryRaw = JSON.parse(rawJSON)
        console.log(queryRaw)

        const requestID = Math.random().toString().split('.')[1]
        // const name = `${route.name || request.url}:${method.name || methodName}`
        console.log(`Request=${requestID} in context=${Array.from(request.headers.entries())}`)

        // let ctx = await this.contextualizer({ /* TODO contextual logging */ })

        // if (this.app.common.middleware) {
        //     for (const middleware of this.app.common.middleware) {
        //         ctx = await middleware(ctx, request)
        //     }
        // }

        const reply = await this.graphql(queryRaw.query)

        const response = {
            body: JSON.stringify(reply.body),
            status: reply.status,
        }

        // if (this.app.common.hooks) {
        //     for (const hook of this.app.common.hooks) {
        //         await hook(ctx, request, response)
        //     }
        // }

        // TODO need to think through handling completeness but a failure in a post step
        await request.respond(response)
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
