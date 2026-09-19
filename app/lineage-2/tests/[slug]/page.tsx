import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TestDetail } from "@/components/tests/test-detail";
import { getRedplayTest, redplayTestAliases, redplayTests } from "@/lib/tests/data";

type Params = { slug: string };

export function generateStaticParams() {
  return [...redplayTests.map((test) => test.slug), ...Object.keys(redplayTestAliases)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const test = getRedplayTest((await params).slug);
  if (!test) return { title: "Тест не найден | RedPlay" };
  return {
    title: `${test.number} — ${test.shortTitle}`,
    description: test.answer,
    robots: { index: false, follow: false },
  };
}

export default async function TestPage({ params }: { params: Promise<Params> }) {
  const slug = (await params).slug;
  const test = getRedplayTest(slug);
  if (!test) notFound();
  if (test.slug !== slug) redirect(`/lineage-2/tests/${test.slug}`);
  return <TestDetail test={test}/>;
}
