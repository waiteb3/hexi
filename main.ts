import Hexi from "./hexi.ts"

class DB {
    constructor() {}
    get(id: string) {
        return { id, value: Math.random() }
    }
}

interface Context {
    db: DB
}

const app = new Hexi<Context>((ctx) => Promise.resolve({ db: ctx.db ?? new DB() }), {
    common: {},
    routes: {
        'Root': {
            get: {
                async handler(ctx, request) {
                    return { response: ctx.db.get('1') }
                }
            }
        },
    }
})
await app.listen()