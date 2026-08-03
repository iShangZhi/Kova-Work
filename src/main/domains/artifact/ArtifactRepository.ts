import type { Artifact } from '../../../shared/contracts'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

interface ArtifactState {
  artifacts: Artifact[]
}

export class ArtifactRepository {
  constructor(private store: JsonStore<ArtifactState>) {}

  async save(artifact: Artifact): Promise<void> {
    this.store.setState((state) => {
      const index = state.artifacts.findIndex((a) => a.id === artifact.id)
      if (index >= 0) {
        state.artifacts[index] = artifact
      } else {
        state.artifacts.push(artifact)
      }
    })
  }
}
