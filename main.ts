import Hexi from "./hexi.ts"

class DB {
    constructor() {}
    get(id: string) {
        return { id, value: Math.random() }
    }
}

class Context {
    private _db?: DB
    readonly start: number

    constructor() {
        this.start = Date.now()
    }

    get db() {
        if (!this._db) {
            this._db = new DB()
        }
        return this._db
    }
}

const app = new Hexi<Context>((ctx) => Promise.resolve(new Context()), {
    common: {
        hooks: [
            (ctx, req, res) => {
                console.log(Date.now() - ctx.start, 'ms')
            }
        ]
    },
    routes: {
        '/': {
            get: {
                async handler(ctx, request) {
                    return { response: ctx.db.get('1') }
                }
            }
        },
    }
})

const host = new URL(Deno.args[0] || 'http://localhost:8000')
await app.listen({ hostname: host.hostname, port: parseInt(host.port || '80') })
