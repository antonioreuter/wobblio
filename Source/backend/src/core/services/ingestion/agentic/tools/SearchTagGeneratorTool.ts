import type { ITagGenerator, TagGenerationInput } from '../../../../ports/data-intelligence/ITagGenerator';

// Tool 5 (parent §3): pick ≤3 search tags from the SSM-managed vocabulary (deterministic
// triggers + piggybacked LLM suggestions). Thin wrapper over TagGenerator.
export class SearchTagGeneratorTool {
  constructor(private readonly tagGenerator: ITagGenerator) {}

  run(input: TagGenerationInput): Promise<string[]> {
    return this.tagGenerator.generate(input);
  }
}
