// magic link type auth
// public key or email based supported
import { Router } from '../router.ts'
import { HexiContext, HexiReply, HexiRequest, PluginHandler } from '../server.ts'
import { Auth } from './auth.ts'

// TODO run sandboxed
import { RSA } from 'https://deno.land/x/god_crypto/rsa.ts'

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
        this.router.get('/magic/start-session', this.startNewSession)
    }

    viewNewSession = async (ctx: HexiContext, req: HexiRequest): Promise<HexiReply<string>> => {
        return {
            body: `
                <p>Enter in your RSA PUBLIC Key. If you do not have one yet, you can follow these instructions. ENSURE THAT YOU BACK UP YOUR private.pem FILE</p>
                <pre> openssl genrsa -des3 -out private.pem 2048 </pre>
                <pre> openssl rsa -in private.pem -outform PEM -pubout -out public.pem </pre>
                Then enter your PUBLIC KEY in public.pem into the form
            `,
            type: 'html',
        }
    }

    initNewSession = async (ctx: HexiContext, req: HexiRequest): Promise<HexiReply<string>> => {
        const publicKey = RSA.parseKey(await Deno.readTextFile('public.pem'))
        const cipher = await new RSA(publicKey).encrypt("http://localhost:8000/auth/magic/start-session?token=secret", {
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

    startNewSession = async (ctx: HexiContext, req: HexiRequest): Promise<HexiReply<string>> => {
        return {
            body: `todo`,
            type: 'html',
        }
    }

    get router() {
        return this._router
    }
}
