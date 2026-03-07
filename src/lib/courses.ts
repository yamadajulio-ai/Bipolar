import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

const coursesDirectory = path.join(process.cwd(), "content", "cursos");

const ALLOWED_VIDEO_DOMAINS = ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"];

function sanitizeVideoUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (ALLOWED_VIDEO_DOMAINS.includes(u.hostname)) return url;
  } catch { /* invalid URL */ }
  return null;
}

export interface CourseInfo {
  slug: string;
  title: string;
  description: string;
  totalLessons: number;
}

export interface LessonInfo {
  slug: string;
  courseSlug: string;
  title: string;
  description: string;
  lessonNumber: number;
  videoUrl: string | null;
}

export interface LessonContent extends LessonInfo {
  contentHtml: string;
}

export function getAllCourses(): CourseInfo[] {
  if (!fs.existsSync(coursesDirectory)) return [];

  const courseDirs = fs.readdirSync(coursesDirectory, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  return courseDirs.map((dir) => {
    const metaPath = path.join(coursesDirectory, dir, "_meta.md");
    let title = dir;
    let description = "";

    if (fs.existsSync(metaPath)) {
      const content = fs.readFileSync(metaPath, "utf-8");
      const { data } = matter(content);
      title = data.title || dir;
      description = data.description || "";
    }

    const lessons = fs.readdirSync(path.join(coursesDirectory, dir))
      .filter((f) => f.endsWith(".md") && f !== "_meta.md");

    return { slug: dir, title, description, totalLessons: lessons.length };
  }).sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getCourseLessons(courseSlug: string): LessonInfo[] {
  const courseDir = path.join(coursesDirectory, courseSlug);
  if (!fs.existsSync(courseDir)) return [];

  const files = fs.readdirSync(courseDir)
    .filter((f) => f.endsWith(".md") && f !== "_meta.md")
    .sort();

  return files.map((file) => {
    const content = fs.readFileSync(path.join(courseDir, file), "utf-8");
    const { data } = matter(content);
    const slug = file.replace(/\.md$/, "");

    return {
      slug,
      courseSlug,
      title: data.title || slug,
      description: data.description || "",
      lessonNumber: data.lessonNumber || parseInt(slug.split("-")[0]) || 0,
      videoUrl: sanitizeVideoUrl(data.videoUrl),
    };
  });
}

export async function getLessonContent(courseSlug: string, lessonSlug: string): Promise<LessonContent | null> {
  const filePath = path.join(coursesDirectory, courseSlug, `${lessonSlug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  const processed = await remark()
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(content);

  return {
    slug: lessonSlug,
    courseSlug,
    title: data.title || lessonSlug,
    description: data.description || "",
    lessonNumber: data.lessonNumber || parseInt(lessonSlug.split("-")[0]) || 0,
    videoUrl: sanitizeVideoUrl(data.videoUrl),
    contentHtml: processed.toString(),
  };
}
