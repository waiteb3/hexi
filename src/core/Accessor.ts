import * as Sequelize from 'sequelize'

export const ORM = Sequelize

const {
    DB_HOST,
    DB_NAME,
    DB_USER,
    DB_PASS,
} = Object.assign({}, process.env, {
    DB_HOST: '<%= DB_HOST %>',
    DB_NAME: '<%= DB_NAME %>',
    DB_USER: '<%= DB_USER %>',
    DB_PASS: '<%= DB_PASS %>',
})

let db = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
    host: DB_HOST,
    port: 5432,
    dialect: 'postgresql',
})

if (process.argv.includes('-dev')) {
    db = new Sequelize('app', '', '', {
        dialect: 'sqlite',
    })
}

export const database = db

const defineDefaultOptions: Sequelize.DefineOptions<{}> = {
    underscored: true,
    underscoredAll: true,
    freezeTableName: true,
}

database.define = function define<M, T>(modelName: string, attributes: Sequelize.DefineModelAttributes<T>, options: Sequelize.DefineOptions<M> = {}): Sequelize.Model<M, T> {
    return Sequelize.prototype.define.call(this, modelName, attributes, {
        ...defineDefaultOptions,
        ...options,
    })
}

export default abstract class Accessor<T, M> {
    async transaction<T>(block: (t: Sequelize.Transaction) => Promise<T>): Promise<T> {
        return database.transaction(block)
    }
}
