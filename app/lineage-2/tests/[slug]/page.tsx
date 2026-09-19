import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TestDetail } from "@/components/tests/test-detail";
import { getRedplayTest, redplayTests } from "@/lib/tests/data";

type Params = { slug: string };

export function generateStaticParams() {
  return redplayTests.map((test) => ({ slug: test.slug }));
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
  const test = getRedplayTest((await params).slug);
  if (!test) notFound();
  return <TestDetail test={test}/>;
}

