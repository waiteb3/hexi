export class Router<H> {
    subroutes: { [p: string]: Router<H> }
    private _routes: { [pm: string]: H }
    notFound: H

    constructor(notFound: H) {
        this.subroutes = {}
        this._routes = {}
        this.notFound = notFound
    }

    private from(path: string, method: string) {
        return `${path}::${method.toUpperCase()}`
    }

    match(path: string, method: string): H {
        const subroute = this.subroutes[path]
        if (subroute) {
            return subroute.match(path, method)
        }
        const match = this._routes[this.from(path, method)]
        if (match) {
            return match
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

    }
}
