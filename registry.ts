import { DB } from 'https://deno.land/x/sqlite/mod.ts'
import { ColumnName, Rows } from "https://deno.land/x/sqlite@v2.3.0/src/rows.ts"

import { Model, Ref, StorageField, StorageHistoryMode } from "./models.ts"

// const db = new DB()
const db = new DB('test.db')
db.query('PRAGMA foreign_keys = 1')

function dump<T>(t: T): T {
    console.log(t)
    return t
}

export class Registry {
    db: DB
    name: string
    model: Model
    fields: StorageField[]
    history: StorageHistoryMode

    constructor(name: string, model: Model) {
        this.db = db
        this.name = name
        this.model = model
        this.history = model.kind || 'default'

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
                        modifiers: field.modifiers,
                    }
                    case 'blob': return {
                        kind: 'column',
                        name: k,
                        storageType: 'text',
                        apiType: 'String',
                        modifiers: field.modifiers,
                    }
                    case 'int': return {
                        kind: 'column',
                        name: k,
                        storageType: 'int',
                        apiType: 'Int',
                        modifiers: field.modifiers,
                    }
                    case 'decimal': return {
                        kind: 'column',
                        name: k,
                        storageType: 'decimal',
                        apiType: 'Float',
                        modifiers: field.modifiers,
                    }
                    case 'datetime': return {
                        kind: 'column',
                        name: k,
                        storageType: 'text',
                        apiType: 'String',
                        modifiers: field.modifiers,
                    }
                    case 'timestamp': return {
                        kind: 'column',
                        name: k,
                        storageType: 'text',
                        apiType: 'String',
                        modifiers: field.modifiers,
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

        db.query(`CREATE TABLE IF NOT EXISTS ${this.name} (id CHAR(16) PRIMARY KEY NOT NULL)`)

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
        if (this.history === 'private') {
            return null
        }

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

    async find(name: string, value: any) {
        // TODO unsafe
        // TODO consider loading all and erroring if not unique? or add concept of queryable fields of id | param for [1] | [..N]
        const field = this.fields.find(field => field.name === name)
        if (!field) {
            throw new Error(`Field type '${name}' not found on model '${this.name}'`)
        }
        const query = `
            SELECT ${this.fields.map(this.columnName)}
            FROM ${this.name}
            WHERE ${this.columnName(field)} = :value LIMIT 1
        `
        console.log('QUERY:', query)
        value = await this.valueInto(field, value)
        const rows = db.query(query, { value: field.kind === 'ref' ? value.id : value })
        const [ obj ] = await this.mapObjects(rows)
        return dump(obj)
    }

    async mapObjects(rows: Rows) {
        let row = rows.next()
        if (row.done) {
            rows.return()
            return []
        }

        const cols = this.fields.reduce((cols: { [key: string]: { field: StorageField, index: number }}, field, index) => {
            cols[field.name] = { field, index }
            return cols
        },  {})

        const objs = []
        while (!row.done) {
            const obj = {} as any
            for (const col in cols) {
                const column = cols[col]
                if (column.field.kind === 'ref') {
                    obj[col] = { id: row.value[column.index] }
                } else {
                    obj[col] = await this.fromRaw(column.field, row.value[column.index])
                }
            }
            objs.push(obj)
            row = rows.next()
        }

        rows.return()

        return objs as (Ref & Object)[]
    }

    async get(id: string) {
        const query = `SELECT ${this.fields.map(this.columnName)} FROM ${this.name} WHERE id = :id LIMIT 1`
        console.log('QUERY:', query, id)
        const rows = db.query(query, { id: id })
        const [obj] = await this.mapObjects(rows)
        return dump(obj)
    }

    async listAll() {
        const query = `SELECT ${this.fields.map(this.columnName)} FROM ${this.name}`
        console.log('QUERY:', query)
        const rows = db.query(query)
        const objs = await this.mapObjects(rows)
        return dump(objs)
    }

    async create(params: any) {
        // TODO all sorts of assertions
        //  null checks
        //  refs belong to org
        //  SHRT_guid ID format or composite keys of (id++, other)
        const idRandomness = new Uint8Array(16)
        crypto.getRandomValues(idRandomness)
        const id = idRandomness.reduce((memo, i) => memo + `0${i.toString(16)}`.slice(-2), '')

        const keys = [ 'id' ]
        const values: { [key: string]: any } = { id }
        for (const param of Object.keys(params)) {
            const field = this.fields.find(field => field.name == param)
            if (field == null) {
                throw new Error('Undefined field ' + field)
            }
            const key = this.columnName(field)
            const value = field.kind == 'ref' ? params[field.name].id : params[field.name]
            keys.push(key)
            values[key] = await this.valueInto(field, value) || null
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

            const key = this.columnName(field)
            const value = field.kind == 'ref' ? patch[field.name].id : patch[field.name]
            keys.push(key)
            values[key] = await this.valueInto(field, value) || null
        }

        const query = `UPDATE ${this.name} SET
            ${keys.map(k => `${k} = :${k}`).join(',\n\t')}
        WHERE id = :id`
        console.log('QUERY:', query, ref, patch)
        db.query(query, { ...values, id: ref.id })

        return this.get(ref.id)
    }

    private async valueInto<T>(field: StorageField, value: T): Promise<T> {
        if (field.kind == 'ref') {
            return value
        }

        for (const modifier of field.modifiers || []) {
            value = await modifier.store(value)
        }
        return value
    }

    private async fromRaw<T>(field: StorageField, raw: T): Promise<T> {
        if (field.kind == 'ref') {
            return raw
        }

        for (const modifier of field.modifiers?.slice().reverse() || []) {
            raw = await modifier.load(raw)
        }
        return raw
    }

    private columnName(field: StorageField) {
        return field.kind == 'ref' ? `${field.name}_id` : field.name
    }
}
