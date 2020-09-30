import * as YAML from 'https://deno.land/std@0.69.0/encoding/yaml.ts'
import { assert } from "https://deno.land/std@0.69.0/_util/assert.ts"
import Hexi from './hexi.ts'

const file = await Deno.stat('.env')
if (file) {
    const contents = await Deno.readTextFile('.env')
    for (const line of contents.split('\n')) {
        const [ key, val ] = line.split('=', 2)
        if (!key) {
            continue
        }
        assert(val, `Missing value for key: '${key}'`)

        Deno.env.set(key, val)
    }
}

await new Hexi({
    server: {
        listen: {
            hostname: 'localhost',
            port: 8000,
        },
        secrets: {
            oauth: {
                type: 'github',
                client_id: Deno.env.get('GITHUB_OAUTH_CLIENT_ID') || '',
                client_secret: Deno.env.get('GITHUB_OAUTH_CLIENT_SECRET') || '',
            },
        },
    },
    objects: {
        // TODO enforce things
        Photo: {
            fields: {
                name: {
                    type: 'text',
                },
                creator: {
                    kind: 'ref',
                    ref: 'Account',
                }
            },
        },
    },
}).listen()
