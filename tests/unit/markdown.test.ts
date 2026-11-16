import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../../src/shared/domain/markdown';
import { createEmptyStory } from '../../src/shared/domain/normalize';

describe('markdown importer', () => {
  it('imports event metadata and a branch without mutating the source story', () => {
    const base = createEmptyStory('测试');
    const result = parseMarkdown(`### 2030/03/20 清晨 - 初次记录\n**线路**: 主线\n**地点**: 观测站\n**人物**: 甲, 乙\n\n> 一句话摘要\n\n正文\n\n## 结局分支: 北线 (分歧点: 初次记录)\n\n### 2030/03/21 上午 - 分支继续\n**地点**: 北站\n\n> 分支摘要`, base);
    expect(result.story.events).toHaveLength(2);
    expect(result.story.branches).toHaveLength(1);
    expect(result.story.branches[0].parentEventId).toBe(result.story.events[0].id);
    expect(base.events).toHaveLength(0);
    expect(result.story.events[0].content).toBe('正文');
  });
});
