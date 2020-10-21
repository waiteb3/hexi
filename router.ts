export class Router<H> {
    subroutes: { [p: string]: Router<H> }
    private _routes: { [pm: string]: H }
    notFound: H

    constructor(notFound: H) {
        this.subroutes = {}
        this._routes = {}
        this.notFound = notFound
    }

    private normalize(path: string) {
        if (path.length == 1) {
            return path
        }
        if (path.endsWith('/')) {
            return path.slice(0, -1)
        }
        return path
    }

    private from(path: string, method: string) {
        return `${this.normalize(path)}::${method.toUpperCase()}`
    }

    match(path: string, method: string): H {
        path = this.normalize(path)
        const match = this._routes[this.from(path, method)]
        if (match) {
            return match
        }

        const parts = path.split('/')
        return this.submatch(parts.length, parts, method)
    }

    private submatch(depth: number, parts: string[], method: string): H {
        const subpath = parts.slice(0, depth).join('/')
        const subroute = this.subroutes[subpath]
        if (subroute) {
            return subroute.match('/' + parts.slice(depth).join('/'), method)
        }
        if (depth >= 0) {
            return this.submatch(depth - 1, parts, method)
        }
        return this.notFound
    }

    use(path: string, router: Router<H>) {
        this.subroutes[path] = router
    }

    get(path: string, h: H) {
        this._routes[this.from(path, 'get')] = h
        return this
    }

    put(path: string, h: H) {
        this._routes[this.from(path, 'put')] = h
        return this
    }

    post(path: string, h: H) {
        this._routes[this.from(path, 'post')] = h
        return this
    }

    patch(path: string, h: H) {
        this._routes[this.from(path, 'patch')] = h
        return this
    }

    delete(path: string, h: H) {
        this._routes[this.from(path, 'delete')] = h
        return this
    }

    get routes() {
        const paths: string[] = []
        for (const path in this._routes) {
            paths.push(path)
        }
        for (const path in this.subroutes) {
            const router = this.subroutes[path]
            paths.push(...router.routes.map(r => path + r))
        }
        return paths
    }
}
