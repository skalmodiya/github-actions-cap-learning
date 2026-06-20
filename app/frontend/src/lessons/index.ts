import { ghaBasicsModule } from './01-gha-basics'
import { capSetupModule } from './02-cap-setup'
import { btpDeployModule } from './03-btp-deployment'
import { ghaAdvancedModule } from './04-gha-advanced'
import { capAdvancedModule } from './05-cap-advanced'
import { monitoringModule } from './06-monitoring'
import type { Module } from '../types'

export const MODULE_LIST: Module[] = [
  ghaBasicsModule,
  capSetupModule,
  btpDeployModule,
  ghaAdvancedModule,
  capAdvancedModule,
  monitoringModule,
]
