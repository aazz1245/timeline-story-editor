import { describe, expect, it } from 'vitest';
import { parseMarkdown, renderEventMarkdown, renderStoryMarkdown } from '../../src/shared/domain/markdown';
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

  it('round-trips event body data from the markdown profile block', () => {
    const base = createEmptyStory('测试');
    const result = parseMarkdown(`### 2030/03/20 清晨 - 档案事件\n**人物**: 甲\n\n正文\n\n#### 人物档案\n\n##### 甲\n- **身份**: NPC\n- **内衣款式**: 黑色\n- **笼具**: 金属笼\n- **特殊饰品**: 耳机, 项链\n- **胸围**: 92cm\n- **罩杯**: C\n- **状态**: 勃起\n- **尺寸**: 12cm`, base);
    const profile = result.story.events[0].peopleData['甲'];
    expect(result.story.events[0].people).toEqual(['甲']);
    expect(profile.isNPC).toBe(true);
    expect(profile.underwear).toBe('黑色');
    expect(profile.cage).toBe('金属笼');
    expect(profile.specialAccessories).toEqual([{ type: '耳机' }, { type: '项链' }]);
    expect(profile.bustSize).toBe(92);
    expect(profile.cup).toBe('C');
    expect(profile.penisLength).toBe(12);
  });

  it('exports branch structure and event character profiles', () => {
    const story = parseMarkdown(`### 2030/03/20 上午 - 主线事件
**人物**: 甲

主线正文

## 结局分支: 北线 (分歧点: 主线事件)

### 2030/03/21 下午 - 分支事件
**人物**: 甲

分支正文

#### 人物档案

##### 甲
- **内衣款式**: 黑色
- **胸围**: 92cm`, createEmptyStory('测试')).story;

    const storyMarkdown = renderStoryMarkdown(story);
    const branchEvent = story.events.find(event => event.title === '分支事件')!;
    const eventMarkdown = renderEventMarkdown(branchEvent, story.branches, true);

    expect(storyMarkdown).toContain('## 结局分支: 北线 (分歧点: 主线事件)');
    expect(storyMarkdown).toContain('##### 甲');
    expect(storyMarkdown).toContain('- **内衣款式**: 黑色');
    expect(eventMarkdown).toContain('**线路**: 北线');
    expect(eventMarkdown).toContain('**地点**:');
    expect(eventMarkdown).toContain('**人物**: 甲');
  });
});
