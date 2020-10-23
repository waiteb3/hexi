// TODO don't export unnecessary things
export interface Model {
    fields: { [name: string]: ModelField }
    kind?: StorageHistoryMode
}

export type Validation = string

export interface FieldModifier<S, P, D> {
    data: D
    load(stored: S): Promise<P>
    store(pre: P): Promise<S>
    name: string
}

const EncryptedStorage: FieldModifier<string, string, { key: string }> = {
    name: 'EncryptedStorage',
    data: {
        // TODO configurable, cloud KMSes
        key: '<encrypted>',
    },

    async load(stored: string) {
        return stored && stored.slice(this.data.key.length + 1)
    },

    async store(pre: string) {
        return pre && `${this.data.key}:${pre}`
    }
}

const JSONMapper: FieldModifier<string, any, null> =  {
    name: 'JSONMapper', // TODO annotation?
    data: null,

    async load(stored: string) {
        return stored && JSON.parse(stored)
    },

    async store(pre: any) {
        return pre && JSON.stringify(pre)
    },
}

export type ModelField = {
    kind?: 'field'
    type: 'text' | 'blob' | 'int' | 'decimal' | 'datetime' | 'timestamp'
    validation?: Validation[]
    modifiers?: FieldModifier<unknown, unknown, unknown>[]
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
    modifiers?: FieldModifier<any, any, any>[]
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
            token: {
                type: 'text',
                modifiers: [EncryptedStorage],
            },
        },
    },
    Organization: {
        kind: 'private',
        fields: {
            kind: {
                type: 'text',
            },
            remote_id: {
                type: 'text',
            },
            name: {
                type: 'text',
            },
        },
    },
    // credential & auth set
    Account: {
        kind: 'private',
        fields: {
            kind: {
                type: 'text',
            },
            contact: {
                type: 'text',
                modifiers: [JSONMapper, EncryptedStorage],
            },
            // TODO private fields
            reference_key: {
                type: 'text',
            },
            reference_source: {
                type: 'text',
                modifiers: [EncryptedStorage],
            },
            confirmed: {
                type: 'timestamp',
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
                ref: 'Roles',
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
