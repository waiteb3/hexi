//     login = async () => {
//         const url = `https://github.com/login/oauth/authorize?client_id=${this.config.client_id}`
//         console.log("Sending to github", url)
//         return {
//             body: `Redirecting to OAuth Login Page for Github at ${url}`,
//             http_action: {
//                 type: 'redirect',
//                 url,
//             },
//             status: 302,
//         }
//     }

        // TODO encapsulate & generify & routing
        // TODO use state field for anti forgery
        // TODO create account & go to org form via invite code
        // if (path === '/auth/github/callback') {
        //     const body = [
        //         [ 'client_id', this.app.server.secrets.auth.client_id ],
        //         [ 'client_secret', this.app.server.secrets.auth.client_secret ],
        //         [ 'code', queryParams.get('code') || '' ],
        //     ]
        //     console.log(path)
        //     console.log(queryParams.toString(), body)

        //     const query = new URLSearchParams(body)
        //     const url = `https://github.com/login/oauth/access_token?${query.toString()}`
        //     console.log(url)
        //     type GHAccess = {
        //         access_token: string
        //     }
        //     const authorization = await fetchJSON<GHAccess>(url, {
        //          method: 'POST',
        //          headers: { 'accept': 'application/json' }
        //     })

        //     // TODO anonymiser that print keys and shasum
        //     console.log(authorization.data)
        //     console.log(Array.from(authorization.response.headers.entries()))

        //     // curl https://api.github.com/user -H 'accept: application/json' -H 'authorization: token
        //     const user = await fetchJSON('https://api.github.com/user', {
        //         headers: { 'authorization': `token ${authorization.data.access_token}`}
        //     })
        //     console.log(user.data)
        //     console.log(Array.from(user.response.headers.entries()))

        //     const root = `http://localhost:8000/?token=${authorization.data.access_token}`
        //     console.log(root)

        //     await request.respond({
        //         body: `Redirecting to root`,
        //         headers: new Headers([ ['Location', root] ]),
        //         status: 302,
        //     })
        //     return
        // }
