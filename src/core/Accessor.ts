import * as Sequelize from 'sequelize'

export const ORM = Sequelize

export const database = new Sequelize('db', '', '', {
    dialect: 'sqlite',
})

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