// TODO don't export unnecessary things

export interface Model {
    fields: { [name: string]: ModelField }
    kind?: StorageHistoryMode
}

export type Validation = string

export type ModelField = {
    kind?: 'field'
    type: 'text' | 'blob' | 'int' | 'decimal' | 'datetime'
    validation?: Validation[]
} | {
    kind: 'ref'
    ref: Model | string
}

export type StorageHistoryMode = 'default' | 'archive' | 'append-only'

export type StorageFieldTypes = {
    storageType: 'id'
    apiType: 'ID'
} | {
    storageType: 'text'
    apiType: 'String'
} | {
    storageType: 'blob'
    apiType: 'String'
} | {
    storageType: 'int'
    apiType: 'Int'
} | {
    storageType: 'decimal'
    apiType: 'Float'
}

// TODO instead of ref, have special columms like Creator, etc, that pull from assumed metadata
export type StorageField = (StorageFieldTypes & {
    kind: 'column'
    name: string
}) | {
    kind: 'ref'
    name: string
    ref: string
    storageType: 'text'
    apiType: 'Ref'
}

// org<:orgid>:administrate
// org:<:orgid>:(read|write)

export const defaults: { [name: string]: Model } = {
    Organization: {
        fields: {
            name: {
                type: 'text',
            },
        },
    },
    Account: {
        fields: {
            kind: {
                type: 'text',
            },
            reference: {
                type: 'text',
            }
        }
    }
}

export const associatedFields: { [name: string]: ModelField } = {
    id: {
        type: 'text',
    },
    organization: {
        kind: 'ref',
        ref: defaults.Organization,
    },
}

export type Ref = { id: string }
