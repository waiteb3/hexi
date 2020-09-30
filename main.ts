import * as YAML from 'https://deno.land/std@0.69.0/encoding/yaml.ts'
import Hexi from './hexi.ts'

await new Hexi({
    server: {
        listen: {
            hostname: 'localhost',
            port: 8000,
        },
    },
    objects: {
        // # todo enforce things
        Photo: {
	    fields: {
                name: {
                    type: 'text', 
                },
	    },
        },
    },
}).listen()
