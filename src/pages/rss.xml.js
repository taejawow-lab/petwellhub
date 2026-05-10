import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return rss({
    title: import.meta.env.PUBLIC_SITE_NAME || 'Editorial',
    description:
      import.meta.env.PUBLIC_SITE_DESCRIPTION ||
      'Data-grounded editorial publication',
    site: context.site,
    items: posts
      .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
      .map((post) => ({
        title: post.data.title,
        pubDate: post.data.pubDate,
        description: post.data.description,
        link: `/posts/${post.slug}/`,
        categories: post.data.tags || [],
      })),
    customData: `<language>${import.meta.env.PUBLIC_SITE_LANG || 'en'}</language>`,
  });
}