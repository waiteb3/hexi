import * as YAML from 'https://deno.land/std@0.69.0/encoding/yaml.ts'
import { assert } from "https://deno.land/std@0.69.0/_util/assert.ts"
import Hexi from './hexi.ts'

import { makeJwt, setExpiration, Jose, Payload } from 'https://deno.land/x/djwt/create.ts';

const file = await Deno.stat('.env').catch((err) => err instanceof Deno.errors.NotFound ? null : Promise.reject(err))
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

const key = await Deno.readTextFile('github-app.pem')
const now = Math.floor(Date.now() / 1000)
const payload: Payload = {
    iat: now,
    exp: now + (10 * 60),
    iss: Deno.env.get('GITHUB_APP_ID') || '',
}
const header: Jose = {
    alg: 'RS256',
    typ: 'JWT',
}
const token = await makeJwt({ key, header, payload })
// var req = await fetch('https://api.github.com/app', {
//     headers: {
//         'Authorization': `Bearer ${token}`,
//         'Accept': 'application/vnd.github.v3+json',
//     },
// })
// console.log(header, payload)
// console.log(req.status, req.statusText, JSON.stringify(await req.json(), null, '   '))
// assert(req.ok)

// var req = await fetch('https://api.github.com/app/installations', {
//     headers: {
//         'Authorization': `Bearer ${token}`,
//         'Accept': 'application/vnd.github.v3+json',
//     },
// })
// console.log(header, payload)
// console.log(req.status, req.statusText, JSON.stringify(await req.json(), null, '   '))
// assert(req.ok)

// var req = await fetch(`https://api.github.com/app/installations/12390680/access_tokens`, {
//     method: 'POST',
//     headers: {
//         'Authorization': `Bearer ${token}`,
//         'Accept': 'application/vnd.github.v3+json',
//     },
// })
// const data = await req.json()
// console.log(header, payload)
// console.log(req.status, req.statusText, JSON.stringify(data, null, '   '))
// assert(req.ok)

// var req = await fetch('https://api.github.com/orgs/scribe-dev/members', {
//     headers: {
//         'Authorization': `Bearer ${data.token}`,
//         'Accept': 'application/vnd.github.v3+json',
//     },
// })
// console.log(header, payload)
// console.log(req.status, req.statusText, JSON.stringify(await req.json(), null, '   '))
// assert(req.ok)

await new Hexi({
    server: {
        listen: {
            hostname: 'localhost',
            port: 8000,
        },
        secrets: {
            auth: {
                type: 'github',
                client_id: Deno.env.get('GITHUB_APP_CLIENT_ID') || '',
                client_secret: Deno.env.get('GITHUB_APP_CLIENT_SECRET') || '',
                token,
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
