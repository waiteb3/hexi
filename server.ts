import { Model } from './models.ts'
import { Auth } from './auth/auth.ts'
import { Registry } from "./registry.ts"

interface Secrets {
    auth: { [key: string]: Auth<any, any> }
}

export interface AppConfig<C> {
    domain: string
    misc: C
}

export interface AppTree<C> {
    server: {
        listen: Deno.ListenOptions | Deno.ListenTlsOptions
        secrets: Secrets
    }
    config: AppConfig<C>
    objects: { [name: string]: Model }
}

export type HexiContext<C = {}> = {
    logger: (...args: any[]) => Promise<boolean | void>
    registry: { [model: string]: Registry }
    config: AppConfig<C>
    account?: any
}

export type HexiRequest<T = {}> = {
    body: T
    // TODO params -> reflected class + verification
    params: URLSearchParams
}

export type HexiReply<T = {}> = {
    body: T
    http?: {
        action: 'redirect'
        url: string
    } | {
        action: 'not-found'
    } | {
        action: 'server-error'
    }
    type?: 'json' | 'html'
}

export type HandlerConfig = {
    public?: boolean
}

export type PluginHandler<C = {}, R = {}, T = {}> = {
    config?: HandlerConfig
    handler: (ctx: HexiContext<C>, request: HexiRequest<R>) => Promise<HexiReply<T>>
}
