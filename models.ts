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

export type StorageHistoryMode = 'default' | 'archive' | 'append-only' | 'private' | 'join'

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
    Session: {
        kind: 'private',
        fields: {
            account: {
                kind: 'ref',
                ref: 'Account',
            },
            // TODO encrypted
            token: {
                type: 'text',
            },
        },
    },
    Organization: {
        kind: 'private',
        fields: {
            kind: {
                type: 'text', // TODO unique,
            },
            remote_id: {
                type: 'text',
            },
            name: {
                type: 'text',
            },
        },
    },
    Account: {
        kind: 'private',
        fields: {
            kind: {
                type: 'text',
            },
            // TODO scrypted
            // TODO private fields
            credentials: {
                type: 'text',
            },
        }
    },
    // TODO generate only read write admin roles
    Roles: {
        kind: 'append-only',
        fields: {
            name: {
                type: 'text',
            },
            access: {
                type: 'text',
            },
            // TODO consider switching to a list of actions as a proper array
        }
    },
    // TODO account<->org<->role
    OrganizationRoleBinding: {
        kind: 'private',
        fields: {
            organization: {
                kind: 'ref',
                ref: 'Organization',
            },
            account: {
                kind: 'ref',
                ref: 'Account',
            },
            role: {
                kind: 'ref',
                ref: 'Role',
            },
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
