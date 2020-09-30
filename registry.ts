import { DB } from 'https://deno.land/x/sqlite/mod.ts'

import { Model, Ref, StorageField } from "./models.ts"

// const db = new DB()
const db = new DB('test.db')
db.query('PRAGMA foreign_keys = 1')

export class Registry {
    db: DB
    name: string
    model: Model
    fields: StorageField[]

    constructor(name: string, model: Model) {
        this.db = db
        this.name = name
        this.model = model

        this.fields = [{
            kind: 'column',
            name: 'id',
            apiType: 'ID',
            storageType: 'id',
        }]

        const fields = Object.keys(model.fields).map((k): StorageField => {
            const field = model.fields[k]

            switch (field.kind) {
                default:
                case 'field': switch (field.type) {
                    default: // TODO err on default
                    case 'text': return {
                        kind: 'column',
                        name: k,
                        storageType: 'text',
                        apiType: 'String',
                    }
                    case 'blob': return {
                        kind: 'column',
                        name: k,
                        storageType: 'text',
                        apiType: 'String',
                    }
                    case 'int': return {
                        kind: 'column',
                        name: k,
                        storageType: 'int',
                        apiType: 'Int',
                    }
                    case 'decimal': return {
                        kind: 'column',
                        name: k,
                        storageType: 'decimal',
                        apiType: 'Float',
                    }
                    case 'datetime': return {
                        kind: 'column',
                        name: k,
                        storageType: 'text',
                        apiType: 'String',
                    }
                }
                case 'ref': return {
                    kind: 'ref',
                    name: k,
                    ref: field.ref as any, // TODO improve model def
                    storageType: 'text',
                    apiType: 'Ref',
                }
            }
        })

        this.fields.push(...fields)
    }

    syncStorage() {
        const rows = [...db.query(`PRAGMA table_info(${this.name})`).asObjects()]

        db.query(`CREATE TABLE IF NOT EXISTS ${this.name} (id CHAR(16) PRIMARY KEY )`)

        console.log(rows)
        // TODO reverse and add option to drop columns via a tool
        for (const field of this.fields) {
            if (field.name === 'id') {
                continue
            }

            switch (field.kind) {
            case 'column':
            default: {
                const metadata = rows.find(row => row.name === field.name)
                if (metadata) {
                    continue
                }

                console.log(`ALTER TABLE ${this.name} ADD COLUMN ${field.name} ${field.storageType}`)
                db.query(`ALTER TABLE ${this.name} ADD COLUMN ${field.name} ${field.storageType}`)
                break
            }
            case 'ref': {
                const metadata = rows.find(row => row.name === `${field.name}_id`)
                if (metadata) {
                    continue
                }

                console.log(`ALTER TABLE ${this.name} ADD COLUMN ${field.name}_id ${field.storageType} REFERENCES ${field.ref}(id)`)
                db.query(`ALTER TABLE ${this.name} ADD COLUMN ${field.name}_id ${field.storageType} REFERENCES ${field.ref}(id)`)
                break
            }
            }
        }
    }

    getQueries() {
        return [
            // TODO queryable columns
            `find${this.name}: [${this.name}!]!`,
            `get${this.name}(id: String): ${this.name}`,
        ]
    }

    getMutations() {
        // TODO other types
        const types = this.fields.map((field) =>
            `${field.name}: ${field.apiType}` // TODO better refs
        )
        return [
            `save${this.name}(id: String, ${types.join(', ')}): ${this.name}`
        ]
    }

    getTypedef() {
        const def = `type ${this.name} {`
        const types = this.fields.map((field) =>
            `${field.name}: ${field.kind === 'ref' ? field.ref : field.apiType}`
        )
        return `${def}\n\t${types.join('\n\t')}\n}`
    }

    async get(id: string) {
        const query = `SELECT * FROM ${this.name} WHERE id = :id`
        console.log('QUERY:', query)
        const [ obj ] = [...db.query(query, { id: id }).asObjects()]
        return obj as Ref & object | null
    }

    async listAll() {
        const query = `SELECT * FROM ${this.name}`
        console.log('QUERY:', query)
        const objs = [...db.query(query).asObjects()]
        return objs as (Ref & object)[]
    }

    async create(params: any) {
        // TODO all sorts of assertions
        //  null checks
        //  refs belong to org
        //  SHRT_guid ID format or composite keys of (id++, other)
        const id = Math.random().toString().slice(3)
        const keys = [ 'id' ]
        const values: { [key: string]: any } = { id }
        for (const field of this.fields) {
            const key = field.kind == 'ref' ? `${field.name}_id` : field.name
            const value = field.kind == 'ref' ? params[field.name].id : params[field.name]
            keys.push(key)
            values[key] = value || null
        }

        const query = `INSERT INTO ${this.name} (
            ${keys.join(',\n\t')}
        ) VALUES (
            ${keys.map(k => `:${k}`).join(',\n\t')}
        )`
        console.log('QUERY:', query, values)
        db.query(query, values)

        return this.get(id)
    }

    // TODO MAYBE disallow reference and instead add action "move" for changing references
    async update(ref: Ref, patch: any) {
        const keys = [ ]
        const values: { [key: string]: any } = { }
        for (const field of this.fields) {
            // TODO stricter? graphql may be handling this and extra fields
            if (!(field.name in patch)) {
                continue
            }

            const key = field.kind == 'ref' ? `${field.name}_id` : field.name
            const value = field.kind == 'ref' ? patch[field.name].id : patch[field.name]
            keys.push(key)
            values[key] = value || null
        }

        const query = `UPDATE ${this.name} SET
            ${keys.map(k => `${k} = :${k}`).join(',\n\t')}
        WHERE id = :id`
        console.log('QUERY:', query, ref, patch)
        db.query(query, { ...values, id: ref.id })

        return this.get(ref.id)
    }
}