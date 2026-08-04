import type { PluginRepository } from './PluginRepository'
import { logger } from '../../infrastructure/logging/Logger'

/**
 * PluginService - 插件启用状态领域服务
 */
export class PluginService {
  constructor(private readonly repository: PluginRepository) {}

  async isEnabled(pluginId: string): Promise<boolean> {
    return this.repository.isEnabled(pluginId)
  }

  async setEnabled(pluginId: string, enabled: boolean): Promise<void> {
    await this.repository.setEnabled(pluginId, enabled)
    logger.info('Plugin toggled', { pluginId, enabled })
  }
}
