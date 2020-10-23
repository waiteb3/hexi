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

const handlerConfig = { public: true }

export class MagicAuth implements Auth<Handler, MagicAuthConfig> {
    _router: Router<Handler>

    type = 'github-app'
    config: MagicAuthConfig

    constructor(config: MagicAuthConfig) {
        this._router = new Router({} as any)
        this.config = config

        // TODO org invites
        this.router.get('/magic/new-session', { config: handlerConfig, handler: this.viewNewSession })
        this.router.post('/magic/new-session', { config: handlerConfig, handler: this.initNewSession })
        // TODO acccount activation and TOS signing etc
        this.router.get('/magic/confirm-account', { config: handlerConfig, handler: this.viewConfirmAccount })
        this.router.post('/magic/confirm-account', { config: handlerConfig, handler: this.confirmAccount })
    }

    viewNewSession = async (ctx: HexiContext, req: HexiRequest): Promise<HexiReply<string>> => {
        return {
            body: await Deno.readTextFile('magic-rsa.html'),
            type: 'html',
        }
    }

    initNewSession = async (ctx: HexiContext, req: HexiRequest<{ username: string, pem: string }>): Promise<HexiReply<string>> => {
        const referenceKey = new Sha256().update(req.body.pem).toString()
        let account = await ctx.registry.Account.find('reference_key', referenceKey)
        if (!account) {
            account = await ctx.registry.Account.create({
                kind: 'rsa-identity',
                contact: { username: req.body.username, email: '@' },
                reference_key: referenceKey,
                reference_source: req.body.pem,
                confirmed: false,
            })
        }

        const tokenValues = new Uint8Array(32)
        crypto.getRandomValues(tokenValues)
        const token = tokenValues.reduce((memo, i) => memo + `0${i.toString(16)}`.slice(-2), '')

        // TODO findOrCreate with expired logic
        await ctx.registry.Session.create({
            account,
            token,
        }) as any

        const rbac = await ctx.registry.OrganizationRoleBinding.find('account', account)
        const url = rbac
            ? `http://localhost:8000/`
            : `http://localhost:8000/auth/magic/confirm-account`

        const publicKey = RSA.parseKey(req.body.pem)
        const secret = JSON.stringify({ token, url }, null, '\t')
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

    viewConfirmAccount = async (_ctx: HexiContext, _req: HexiRequest<{ pem: string }>): Promise<HexiReply<string>> => {
        return {
            body: await Deno.readTextFile('magic-confirm.html'),
            type: 'html',
        }
    }

    confirmAccount = async (ctx: HexiContext, req: HexiRequest<{ token: string, response: 'accepted' | 'denied' }>): Promise<HexiReply<any>> => {
        if (req.body.response !== 'accepted') {
            return {
                body: 'Account Not Confirmed',
                http: {
                    action: 'not-found', // TODO
                },
            }
        }

        const session = await ctx.registry.Session.find('token', req.body.token) as any
        if (!session) {
            ctx.logger('Session not found on attempt to confirm account')
            return {
                body: 'Confirmation Not Found',
                http: {
                    action: 'not-found',
                },
            }
        }

        const account = await ctx.registry.Account.get(session.account.id) as any
        if (!account) {
            ctx.logger(`Account '${session.account.id}' not found on attempt to confirm account from session '${session.id}'`)
            return {
                body: 'Confirmation Not Found',
                http: {
                    action: 'not-found',
                },
            }
        }

        if (account.confirmed) {
            return {
                body: 'Already Registered',
                http: {
                    action: 'redirect',
                    url: 'http://localhost:8000',
                }
            }
        }

        await ctx.registry.Account.update(account, { confirmed: new Date().toISOString() })

        const organization = await ctx.registry.Organization.create({
            kind: 'rsa',
            remote_id: account.reference_key,
            name: account.contact.username,
        })

        const rbac = await ctx.registry.OrganizationRoleBinding.create({
            organization,
            account,
        })

        return {
            body: {
                rbac,
                organization,
            },
        }
    }

    get router() {
        return this._router
    }
}
