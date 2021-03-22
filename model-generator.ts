import { createRequire } from 'https://deno.land/std@0.76.0/node/module.ts'
import TypeScript from './typescript.d.ts'
import { Model, ModelField } from './model.ts'

const require = createRequire(import.meta.url)
const ts = require('./typescript.js') as typeof TypeScript

export function fieldToMember(name: string, field: ModelField): TypeScript.ClassElement {
    if (field.kind === 'ref') {
        return fieldToMember(name, {
            kind: 'field',
            type: 'text',
        })
    }

    switch (field.type) {
        default:
        case 'text': {
            return ts.factory.createPropertyDeclaration(
                undefined,
                undefined,
                name,
                undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
                undefined,
            )
        }
    }
}

export function generateModel(name: string, model: Model): string {
    const className = ts.createIdentifier(name)

    const decorators: TypeScript.Decorator[] = []
    const typeParameters: TypeScript.TypeParameterDeclaration[] = []
    const inheritanceClauses: TypeScript.HeritageClause[] = []
    const members: TypeScript.ClassElement[] = [
        fieldToMember('id', {
            kind: 'field',
            type: 'text',
        }),
        ts.createMethod(
            undefined, undefined, undefined,
            'test',
            undefined, undefined, [],
            undefined, undefined,
        ),
    ]

    const definition = ts.createClassDeclaration(
        decorators,
        [ts.createToken(ts.SyntaxKind.ExportKeyword), ts.createToken(ts.SyntaxKind.DefaultKeyword)],
        className,
        typeParameters,
        inheritanceClauses,
        members,
    )

    const file = ts.createSourceFile(
        `models/${className}.ts`,
        '',
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.TS,
    )
    const printer = ts.createPrinter({
        newLine: ts.NewLineKind.LineFeed
    })
    const result = printer.printNode(
        ts.EmitHint.Unspecified,
        definition,
        file,
    )

    return result
}

const test = generateModel('Test', {
    kind: 'default',
    fields: {
        token: {
            type: 'text',
        },
    },
})

console.log(test)
