import { NextResponse } from "next/server";

const fallback = {
  Main: [
    { name: "Blackbird", online: 4703 }, { name: "Elcardia", online: 4902 },
    { name: "Hatos", online: 4155 }, { name: "Cadmus 2023", online: 3063 },
  ],
  "Special Project": [
    { name: "Wolf1", online: 1813 }, { name: "Wolf2", online: 2047 }, { name: "Eva1", online: 1943 },
    { name: "Eva2", online: 1690 }, { name: "Samurai1", online: 1728 }, { name: "Samurai2", online: 1438 },
  ],
  Essence: [
    { name: "Amethyst", online: 1038 }, { name: "Peach", online: 1937 }, { name: "Lilac", online: 1506 },
  ],
};

export async function GET() {
  const groups = structuredClone(fallback);
  let live = false;

  try {
    const response = await fetch("https://l2on.net/", { next: { revalidate: 300 } });
    if (response.ok) {
      const text = (await response.text()).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
      let found = 0;
      for (const servers of Object.values(groups)) {
        for (const server of servers) {
          const match = text.match(new RegExp(`${server.name.replace(" ", "\\s*")}[^0-9]{0,80}([0-9]{3,6})`, "i"));
          if (match) { server.online = Number(match[1]); found += 1; }
        }
      }
      live = found >= 6;
    }
  } catch {}

  return NextResponse.json({ groups, updatedAt: new Date().toISOString(), live }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
