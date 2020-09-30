import { serve, ServerRequest, Response } from 'https://deno.land/std@0.69.0/http/server.ts'
import {
    graphql,
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
    buildSchema,
} from 'https://raw.githubusercontent.com/adelsz/graphql-deno/v15.0.0/mod.ts'
import { DB } from 'https://deno.land/x/sqlite/mod.ts'

const db = new DB('test.db')
// const db = new DB()

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

type Validation = string

type ModelField = {
    kind?: 'field' 
    type: 'text' | 'blob' | 'int' | 'decimal' | 'datetime'
    validation?: Validation[]
} | {
    kind: 'ref'
    ref: Model
}

type StorageHistoryMode = 'default' | 'archive' | 'append-only'

interface Model {
    fields: { [name: string]: ModelField }
    kind?: StorageHistoryMode
}

interface AppTree<C> {
    server: {
        listen: Deno.ListenOptions | Deno.ListenTlsOptions
    }
    objects: { [name: string]: Model }
}

type StorageFieldTypes = {
    storageType: 'id'
    apiType: 'ID'
} | {
    storageType: 'text'
    apiType: 'String'
} | {
    storageType: 'blob'
    apiType: 'String'
} | {
    storageType: 'int'
    apiType: 'Int'
} | {
    storageType: 'decimal'
    apiType: 'Float'
}

type StorageField = StorageFieldTypes & ({
    kind: 'column'
    column: string
} | {
    kind: 'ref'
    ref: string
})

// org<:orgid>:administrate
// org:<:orgid>:(read|write)

const defaultModels: { [name: string]: Model } = {
    Organization: {
	fields: {
            name: {
                 type: 'text', 
            },
        },
    },
}

const associatedFields: { [name: string]: ModelField } = {
    id: {
        type: 'text',
    },
    organization: {
        kind: 'ref',
        ref: defaultModels.Organization,
    },
}

class Registry {
    name: string
    model: Model
    fields: StorageField[]

    constructor(name: string, model: Model) {
        this.name = name
        this.model = model

        this.fields = [{
            kind: 'column',
            column: 'id',
            apiType: 'ID',
            storageType: 'id',
        }]
        
        const fields = Object.keys(model.fields).map((k): StorageField => {
            const field = model.fields[k]

            switch (field.kind) {
                default:
                case 'field': switch (field.type) {
                    default: // TODO err on default
                    case 'text': return {
                        kind: 'column',
                        column: k,
                        storageType: 'text',
                        apiType: 'String',
                    }
                    case 'blob': return {
                        kind: 'column',
                        column: k,
                        storageType: 'text',
                        apiType: 'String',
                    }
                    case 'int': return {
                        kind: 'column',
                        column: k,
                        storageType: 'int',
                        apiType: 'Int',
                    }
                    case 'decimal': return {
                        kind: 'column',
                        column: k,
                        storageType: 'decimal',
                        apiType: 'Float',
                    }
                    case 'datetime': return {
                        kind: 'column',
                        column: k,
                        storageType: 'text',
                        apiType: 'String',
                    }
                }
                case 'ref': return {
                    kind: 'ref',
                    ref: k,
                    storageType: 'text',
                    apiType: k,
                }
            }
        })

        this.fields.push(...fields)
    }
    
    syncStorage() {
        const rows = [...db.query(`PRAGMA table_info(${this.name})`)]

        db.query(`CREATE TABLE IF NOT EXISTS ${this.name} (
            id CHAR(16) PRIMARY KEY
        )`)

        console.log(this.fields)
        // TODO reverse and add option to drop columns via a tool
        for (const field of this.fields) {
            if (field.column == 'id') {
                continue
            }

            const metadata = rows.find(row => row.column)
            if (metadata) {
                continue
            }

            switch (field.kind) {
            case 'column':
            default:
                db.query(`ALTER TABLE ${this.name} ADD COLUMN ${field.column} ${field.storageType}`)
            case 'ref':
                db.query(`ALTER TABLE ${this.name} ADD COLUMN ${field.ref.name}_id ${field.storageType} REFERENCES ${field.ref.name}(id)`)
            }
        }
    }

    getQueries() {

    }

    getMutations() {

    }

    get(id: string) {
        const [ obj ] = [...db.query(`SELECT * FROM ${this.name} WHERE id = :id`, { id: id }).asObjects()]
        return obj as Ref & object | null
    }

    listAll() {
        const objs = [...db.query(`SELECT * FROM ${this.name}`).asObjects()]
        return objs as (Ref & object)[]
    }
    
    save(obj: Ref & object) {
        const keys = Object.keys(obj)
        const query = `INSERT INTO ${this.name} (
            ${keys.join(',\n\t')}
        ) VALUES (
            ${keys.map(k => `:${k}`).join(',\n\t')}
        )`
        db.query(query, obj)
        return obj
    }
}

type Ref = { id: string }

export default class Hexi<C> {
    app: AppTree<C>
    schema: GraphQLSchema
    registry: { [name: string]: Registry }
    // mutationResolvers: { [name: string]: (query: Ref) => Promise<any> }
    // queryResolvers: { [name: string]: (query: Ref) => Promise<any> }
    resolvers: { [name: string]: (query: Ref) => Promise<any> }

    constructor(app: AppTree<C>) {
        this.app = app
        this.registry = {}
        this.resolvers = {}
        
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

        let schema = ''

        schema += 'type Query {\n'
        for (const name in app.objects) {
            schema += `\tlist${name}: [${name}!]!\n`
            schema += `\tget${name}(id: String): ${name}\n`
        }
        schema += '}\n'

        schema += 'type Mutation {\n'
        for (const name in app.objects) {
            // TODO other types
            const fields = app.objects[name].fields

        const types = Object.keys(fields).map((field) =>
                `${field}: ${'String'}`
            )
            schema += `\tsave${name}(id: String, ${types.join(', ')}): ${name}\n`
        }
        schema += '}\n'

        for (const name in app.objects) {
            const fields = app.objects[name].fields
            schema += `type ${name} {\n\tid: String!\n`
            for (const field in fields) {
                // TODO
                schema += `\t${field}: String!\n`     
            }
            schema += '}\n'
        }

        console.log(schema)
        this.schema = buildSchema(schema)

        for (const name in this.schema.getTypeMap()) {
            if (name === 'Query' || name === 'Mutation') {
                continue
            }
            const type = this.schema.getTypeMap()[name]
            if (type.astNode) {
                this.resolvers[`list${name}`] = async() => {
                    console.log(name, this.registry[name])
                    return this.registry[name].listAll()
                }
                this.resolvers[`get${name}`] = async (query) => {
                    console.log(name, this.registry[name])
                    return this.registry[name].get(query.id)
                }
                this.resolvers[`save${name}`] = async (params: any) => {
                    console.log(name, this.registry[name])
                    const obj = this.registry[name].get(params.id)
                    if (obj) {
                        Object.assign(obj, params)
                        return this.registry[name].save(obj)
                    }

                    return this.registry[name].save({ id: Math.random().toString().slice(3), ...params })
                }
            }
        }
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

        if (methodName === 'get' && request.url === '/') {
            const index = await Deno.readTextFile('index.html')
            return request.respond({
                body: index,
                status: 200,
            })
        }

        const rawBody = await Deno.readAll(request.body)
        const decoder = new TextDecoder()
        const queryRaw = JSON.parse(decoder.decode(rawBody))
        console.log(queryRaw)

        // if (request.url === '/graphql') {
        //     return request.respond({
        //         body: JSON.stringify(graphql(this.schema, query)),
        //         status: 200,
        //     })
        // }

        const requestID = Math.random().toString().split('.')[1]
        // const name = `${route.name || request.url}:${method.name || methodName}`
        console.log(`Request=${requestID} in context=${''}`)

        // let ctx = await this.contextualizer({ /* TODO contextual logging */ })

        // if (this.app.common.middleware) {
        //     for (const middleware of this.app.common.middleware) {
        //         ctx = await middleware(ctx, request)
        //     }
        // }

        const obj = await graphql(this.schema, queryRaw.query, this.resolvers)
        const reply = {status: 200} //await handler(ctx, request)

        const response = {
            body: JSON.stringify(obj),
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
