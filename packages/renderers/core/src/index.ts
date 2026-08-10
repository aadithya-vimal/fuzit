import type { SecurityFilteredItem } from "@fuzit/core";
import type { ContextBundle, RendererMetadata } from "@fuzit/schemas";

export interface RendererOptionSchema<TOptions> {
  readonly parse: (value: unknown) => TOptions;
}

export interface Renderer {
  readonly metadata: RendererMetadata;
  readonly options: RendererOptionSchema<unknown>;
  readonly render: (
    bundle: ContextBundle,
    items: readonly SecurityFilteredItem[],
    options: unknown,
  ) => string;
}

export class RendererRegistry {
  readonly #renderers = new Map<string, Renderer>();

  constructor(renderers: readonly Renderer[] = []) {
    for (const renderer of renderers) this.register(renderer);
  }

  register(renderer: Renderer): void {
    const format = renderer.metadata.format;
    if (this.#renderers.has(format))
      throw new Error(`Duplicate renderer format: ${format}`);
    this.#renderers.set(format, renderer);
  }

  get(format: string): Renderer {
    const renderer = this.#renderers.get(format);
    if (renderer === undefined)
      throw new Error(`Unknown renderer format: ${format}`);
    return renderer;
  }

  list(): readonly RendererMetadata[] {
    return [...this.#renderers.values()]
      .map(({ metadata }) => metadata)
      .sort((left, right) => left.format.localeCompare(right.format, "en"));
  }
}

export const noRendererOptions: RendererOptionSchema<Record<string, never>> = {
  parse(value) {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).length > 0
    )
      throw new TypeError("Renderer options must be an empty object.");
    return {};
  },
};
