// Astro Content Collections - 글 데이터 스키마 (v5.3 14항목 + v5.4 5항목 추적)
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().max(100),
    description: z.string().max(200),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    heroIllustration: z.string().optional(),
    tags: z.array(z.string()).default([]),
    category: z.string(),

    // v5.3 품질 기준 추적
    sources: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().url(),
          author: z.string().optional(),
          year: z.string().optional(),
          publication: z.string().optional(),
        })
      )
      .min(8, '최소 8건의 1차 자료 인용 필요 (v5.3 #1)'),
    visualsCount: z.number().min(5, '시각 자료 5종 의무 (v5.3 #9-#13)'),
    hasVideo: z.boolean().default(false), // v5.3 #14
    wordCount: z.number().min(1500, '최소 1500단어 / 한국어 3000자 (v5.3 #3)'),

    // 어필리에이트
    affiliate: z.boolean().default(false),

    // v5.4 페널티 회피 추적
    aiDisclosed: z.boolean().default(true), // 자동 footer
    schemaType: z.enum(['Article', 'Review', 'HowTo', 'NewsArticle']).default('Article'),

    // FAQ (v5.4 #11)
    faq: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        })
      )
      .optional(),

    // Internal links (v5.4 #10)
    internalLinks: z.array(z.string()).optional(),

    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
