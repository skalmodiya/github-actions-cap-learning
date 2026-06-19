import { ghaBasicsModule } from './01-gha-basics'
import { capSetupModule } from './02-cap-setup'
import { btpDeployModule } from './03-btp-deployment'
import type { Module } from '../types'

export const MODULE_LIST: Module[] = [
  ghaBasicsModule,
  capSetupModule,
  btpDeployModule,
]
