import { Response } from 'https://deno.land/std@0.69.0/http/server.ts'
import * as YAML from 'https://deno.land/std@0.69.0/encoding/yaml.ts'
import * as TOML from 'https://deno.land/std@0.69.0/encoding/toml.ts'
// TODO import * as CSV from 'https://deno.land/std@0.69.0/encoding/csv.ts'

export type Reply = {
    status?: number
    response: any
}

export interface Marshaller {
    type: string
    marshall: (reply: Reply) => Response
}

export default {
    yaml: {
        type: 'application/x-yaml',
        marshall(reply: Reply) {
            return {
                body: YAML.stringify(reply.response),
                headers: new Headers([ ['content-type', this.type ]]),
            }
        },
    },
    json: {
        type: 'application/json',
        marshall(reply: Reply) {
            return {
                body: JSON.stringify(reply.response),
                headers: new Headers([ ['content-type', this.type ]]),
            }
        },
    },
    toml: {
        type: 'application/x-toml',
        marshall(reply: Reply) {
            return {
                body: TOML.stringify(reply.response),
                headers: new Headers([ ['content-type', this.type ]]),
            }
        },
    },
}
