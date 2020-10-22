// magic link type auth
// public key or email based supported
import { Router } from '../router.ts'
import { HexiContext, HexiReply, HexiRequest, PluginHandler } from '../server.ts'
import { Auth } from './auth.ts'

// TODO run sandboxed
import { RSA } from 'https://deno.land/x/god_crypto/rsa.ts'
import { Sha256 } from 'https://deno.land/std@0.69.0/hash/sha256.ts'

interface MagicAuthConfig {
    mode: 'rsa' | 'email'
}

type Handler = PluginHandler<any, any, any>

export class MagicAuth implements Auth<Handler, MagicAuthConfig> {
    _router: Router<Handler>

    type = 'github-app'
    config: MagicAuthConfig

    constructor(config: MagicAuthConfig) {
        this._router = new Router({} as any)
        this.config = config

        this.router.get('/magic/new-session', this.viewNewSession)
        this.router.post('/magic/new-session', this.initNewSession)
        // TODO acccount activation and TOS signing etc
        // this.router.get('/magic/confirm-account', this.viewConfirmAccount)
        // this.router.post('/magic/confirm-account', this.confirmAccount)
    }

    viewNewSession = async (ctx: HexiContext, req: HexiRequest): Promise<HexiReply<string>> => {
        return {
            body: await Deno.readTextFile('magic-rsa.html'),
            type: 'html',
        }
    }

    initNewSession = async (ctx: HexiContext, req: HexiRequest<{ pem: string }>): Promise<HexiReply<string>> => {
        const referenceKey = new Sha256().update(req.body.pem).toString()
        let account = await ctx.registry.Account.find('reference_key', referenceKey)
        if (!account) {
            account = await ctx.registry.Account.create({
                kind: 'rsa-identity',
                contact: 'test@email.com',
                reference_key: referenceKey,
                reference_source: req.body.pem,
                confirmed: false,
            })
        }

        const tokenValues = new Uint8Array(32)
        crypto.getRandomValues(tokenValues)
        const token = tokenValues.reduce((memo, i) => memo + `0${i.toString(16)}`.slice(-2), '')

        const session = await ctx.registry.Session.create({
            account,
            token,
        }) as any

        const publicKey = RSA.parseKey(req.body.pem)
        const secret = JSON.stringify({ token, url: `http://localhost:8000/?token=${token}` }, null, '\t')
        const cipher = await new RSA(publicKey).encrypt(secret, {
            hash: 'sha1',
            padding: 'pkcs1',
        })

        return {
            body: `
                <p>You session initializer is encrypted.</p>
                <pre> ${cipher.base64()} </pre>
                <p>To decrypt, using your private key, you can run the command</p>
                <pre> echo '${cipher.base64()}' | base64 --decode | openssl rsautl -decrypt -inkey private.pem </pre>
            `,
            type: 'html',
        }
    }

    get router() {
        return this._router
    }
}
