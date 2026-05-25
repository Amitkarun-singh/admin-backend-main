import { SarvamSSTProvider } from "../strategy/SarvamSTTProvide.ts";

const providers = {
  sarvam: SarvamSSTProvider,
};

type ProviderName = keyof typeof providers;
type ProviderInstance = InstanceType<(typeof providers)[ProviderName]>;

export class STTFactory {
  private static instances: Map<ProviderName, ProviderInstance> = new Map();

  private constructor() {}

  static create(name: ProviderName): ProviderInstance {
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }

    const Provider = providers[name];
    if (!Provider) throw new Error(`Unknown STT provider: "${name}"`);

    const instance = new Provider();
    this.instances.set(name, instance);
    return instance;
  }

  // useful for testing
  static reset(name?: ProviderName) {
    name ? this.instances.delete(name) : this.instances.clear();
  }
}
