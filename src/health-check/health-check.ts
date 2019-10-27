import * as Hapi from 'hapi'

import HealthAccessor from 'src/health-check/HealthAccessor'

export default {
    method: 'GET',
    path: '/health-check',
    async handler() {
        return {
            core: await new HealthAccessor().check(),
        }
    }
} as Hapi.ServerRoute
