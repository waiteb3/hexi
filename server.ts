import { ServerRequest } from "https://deno.land/std@0.69.0/http/server.ts"
import { Model } from './models.ts'

interface GithubOAuth {
    type: 'github'
    client_id: string
    client_secret: string
    token: string // TODO
}

type OAuthPlugins = GithubOAuth

interface Secrets {
    auth: OAuthPlugins
}

export interface AppTree<C> {
    server: {
        listen: Deno.ListenOptions | Deno.ListenTlsOptions
        secrets: Secrets
    }
    objects: { [name: string]: Model }
}

export type Reply<T> = {
    body: T,
    status: number,
    type?: 'json' | 'html'
}

export type PluginHandler<T> = (request: Readonly<ServerRequest>) => Promise<Reply<T>>
