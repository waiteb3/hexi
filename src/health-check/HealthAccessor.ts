import Accessor, { ORM, database } from 'src/core/Accessor'

export default class HealthAccessor extends Accessor<{}, {}> {
    async check() {
        await this.transaction(async (t) => {
            await database.query('SELECT 1', { transaction: t })
        })
        return 'Ok'
    }
}
