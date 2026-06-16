import type { ITagGenerator, TagGenerationInput } from '../../ports/data-intelligence/ITagGenerator';
import { categoryShares, type CategoryVoteLine } from '../../domain/classification';
import { generateTags } from '../../domain/tagTriggers';

// §6.10 search-tag generation. Deterministic trigger maps + the LLM tag suggestions
// piggybacked on the §6.3 expansion call. No dedicated LLM call (no spend).
export class TagGenerator implements ITagGenerator {
  async generate(input: TagGenerationInput): Promise<string[]> {
    const voteLines: CategoryVoteLine[] = input.lines.map((line, index) => ({
      categoryId: input.normalized[index].categoryId,
      lineTotal: line.lineTotal,
    }));
    return generateTags({
      categoryId: input.categoryId,
      merchantBrand: input.merchantBrand,
      categoryShares: categoryShares(voteLines),
      suggestedTags: input.suggestedTags,
    });
  }
}
