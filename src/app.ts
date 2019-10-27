require('tsconfig-paths').register()

require('dotenv').config()

import * as Hapi from 'hapi'

import healthCheck from 'src/health-check/health-check'

const server = new Hapi.Server({
    port: process.env.PORT || 3000,
})

server.route(healthCheck)
server.route({ ...healthCheck, path: '/' })

export default server
