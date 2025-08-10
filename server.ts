import express from "express";
import cors from "cors";
import { Client } from "@notionhq/client";

const app = express();
app.use(cors());
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID!;
const SHARED_CLIENT_KEY = process.env.SHARED_CLIENT_KEY;

function authOk(req: express.Request) {
  if (!SHARED_CLIENT_KEY) return true; // allow if not set
  return req.header("x-client-key") === SHARED_CLIENT_KEY;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/loadDays", async (req, res) => {
  try {
    if (!authOk(req)) return res.status(401).send("Unauthorized");
    const pages: any[] = [];
    let cursor: string | undefined = undefined;
    while (true) {
      const resp = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
        sorts: [{ property: "Date", direction: "ascending" }],
      });
      pages.push(...resp.results);
      if (!resp.has_more || !resp.next_cursor) break;
      cursor = resp.next_cursor;
    }

    const days = pages.map((p) => {
      const props: any = (p as any).properties;
      const date = props["Date"].date?.start?.slice(0, 10);
      const checks = {
        "Träning": props["Träning"].checkbox || false,
        "Mat": props["Mat"].checkbox || false,
        "Vatten": props["Vatten"].checkbox || false,
        "Sömn": props["Sömn"].checkbox || false,
        "Arbete": props["Arbete"].checkbox || false,
      };
      return { date, checks };
    }).filter((d) => d.date);

    res.json({ days });
  } catch (e: any) {
    console.error(e);
    res.status(500).send(e.message || "Failed to load");
  }
});

app.post("/api/saveDay", async (req, res) => {
  try {
    if (!authOk(req)) return res.status(401).send("Unauthorized");
    const { date, checks } = req.body as { date: string, checks: Record<string, boolean> };
    if (!date || !checks) return res.status(400).send("Missing date/checks");

    // Find existing page by Date
    const query = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: { property: "Date", date: { equals: date } },
      page_size: 1,
    });

    const properties: any = {
      "Date": { date: { start: date } },
      "Träning": { checkbox: Boolean(checks["Träning"]) },
      "Mat": { checkbox: Boolean(checks["Mat"]) },
      "Vatten": { checkbox: Boolean(checks["Vatten"]) },
      "Sömn": { checkbox: Boolean(checks["Sömn"]) },
      "Arbete": { checkbox: Boolean(checks["Arbete"]) },
    };

    if (query.results.length > 0) {
      const pageId = query.results[0].id;
      await notion.pages.update({ page_id: pageId, properties });
      return res.json({ updated: true, pageId });
    } else {
      const page = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties,
      });
      return res.json({ created: true, pageId: page.id });
    }
  } catch (e: any) {
    console.error(e);
    res.status(500).send(e.message || "Failed to save");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));