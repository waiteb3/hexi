import { ServerRequest } from "https://deno.land/std@0.69.0/http/server.ts"
import { Router } from '../router.ts'
import { HexiContext, HexiReply, HexiRequest, PluginHandler } from '../server.ts'
import { Auth } from './auth.ts'

interface GithubAppAuthConfig {
    client_id: string
    client_secret: string
    token: string
}

type Handler = PluginHandler<any, any, any>

export class GithubAppAuth implements Auth<Handler, GithubAppAuthConfig> {
    _router: Router<Handler>

    type = 'github-app'
    config: GithubAppAuthConfig

    constructor(config: GithubAppAuthConfig) {
        this._router = new Router({} as any)
        this.config = config

        this.router.get('/auth/github/install', { handler: this.install })

        // TODO generic event recorder
        this.router.post('/auth/github/events', { handler: this.events })
    }

    get token() {
        return this.config.token
    }

    events = async (ctx: HexiContext, req: HexiRequest): Promise<HexiReply<string>> => {
        ctx.logger('githubapp.event => ' + JSON.stringify(req.body))
        return {
            body: 'ok',
            type: 'html',
        }
    }

    install = async (ctx: HexiContext, req: HexiRequest): Promise<HexiReply<string>> => {
        const installation_id = req.params.get('installation_id')
        if (!installation_id) {
            return {
                body: 'Missing installation_id',
                http: {
                    action: 'server-error',
                },
                type: 'html',
            }
        }

        const installReq = await fetch(`https://api.github.com/app/installations/${installation_id}`, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        })

        if (!installReq.ok || installReq.status >= 300) {
            await ctx.logger('Unable to load installation metadata from github for', installation_id)
            return {
                body: 'Installation Failed',
                http: {
                    action: 'server-error',
                },
            }
        }

        const install = await installReq.json()

        console.log(install.data)

        const current = await ctx.registry.Organization.find('remote_id', install.data.id)
        if (current) {
            return{
                body: 'Already Registered',
                type: 'html',
            }
        }

        await ctx.registry.Organization.create({ kind: 'github', remote_id: install.data.id, name: install.data.account.login })
        return {
            body: 'Registered',
            type: 'html',
        }
    }

    get router() {
        return this._router
    }
}
