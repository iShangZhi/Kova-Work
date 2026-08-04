import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

export interface PluginStateShape {
  pluginEnabled: Record<string, boolean>
}

export const emptyPluginState = (): PluginStateShape => ({ pluginEnabled: {} })

/**
 * PluginRepository - 插件启用状态存取
 */
export class PluginRepository {
  constructor(private readonly store: JsonStore<PluginStateShape>) {}

  async isEnabled(pluginId: string): Promise<boolean> {
    return this.store.snapshot().pluginEnabled[pluginId] ?? true
  }

  async setEnabled(pluginId: string, enabled: boolean): Promise<void> {
    await this.store.setState((state) => {
      state.pluginEnabled[pluginId] = enabled
    })
  }

  async snapshotAll(): Promise<Record<string, boolean>> {
    return { ...this.store.snapshot().pluginEnabled }
  }
}
