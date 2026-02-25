import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

const CONTENT_DIR = path.join(process.cwd(), "content", "biblioteca");

export interface ContentMeta {
  slug: string;
  title: string;
  description: string;
  readingTime: string;
  order: number;
}

export function getAllContent(): ContentMeta[] {
  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"));

  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf-8");
      const { data, content } = matter(raw);
      const words = content.split(/\s+/).length;
      const readingTime = `${Math.max(1, Math.ceil(words / 200))} min de leitura`;

      return {
        slug: file.replace(".md", ""),
        title: data.title || file.replace(".md", ""),
        description: data.description || "",
        readingTime,
        order: data.order || 99,
      };
    })
    .sort((a, b) => a.order - b.order);
}

export async function getContentBySlug(
  slug: string,
): Promise<{ meta: ContentMeta; html: string } | null> {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const words = content.split(/\s+/).length;
  const readingTime = `${Math.max(1, Math.ceil(words / 200))} min de leitura`;

  const result = await remark()
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(content);

  return {
    meta: {
      slug,
      title: data.title || slug,
      description: data.description || "",
      readingTime,
      order: data.order || 99,
    },
    html: String(result),
  };
}
