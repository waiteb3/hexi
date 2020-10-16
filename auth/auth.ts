import { Router } from '../router.ts'

export interface Auth<H, C> {
    type: string
    config: C
    router: Router<H>
}
