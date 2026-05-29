const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const desyMembers = require("./desyMembers");
console.log("DESY MEMBERS LOADED:", desyMembers);
console.log("IS ARRAY:", Array.isArray(desyMembers));

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const publicationsPath = path.join(__dirname, "..", "data", "publications.json");

function readLocalPublications() {
  const data = fs.readFileSync(publicationsPath, "utf8");
  return JSON.parse(data);
}

function writeLocalPublications(publications) {
  fs.writeFileSync(
    publicationsPath,
    JSON.stringify(publications, null, 2),
    "utf8"
  );
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "DeSy-UTCN-Student-Project/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function getBestPublicationUrl(work) {
  if (work.doi) {
    return work.doi;
  }

  if (work.primary_location?.landing_page_url) {
    return work.primary_location.landing_page_url;
  }

  if (work.primary_location?.pdf_url) {
    return work.primary_location.pdf_url;
  }

  if (work.open_access?.oa_url) {
    return work.open_access.oa_url;
  }

  if (Array.isArray(work.locations)) {
    const locationWithLandingPage = work.locations.find(location => {
      return location.landing_page_url;
    });

    if (locationWithLandingPage) {
      return locationWithLandingPage.landing_page_url;
    }

    const locationWithPdf = work.locations.find(location => {
      return location.pdf_url;
    });

    if (locationWithPdf) {
      return locationWithPdf.pdf_url;
    }
  }

  if (work.id) {
    return work.id;
  }

  return "#";
}

function normalizeOpenAlexWork(work) {
  const title = work.title || "Untitled publication";
  const year = work.publication_year || "Unknown";

  const venue =
    work.primary_location?.source?.display_name ||
    work.host_venue?.display_name ||
    "Unknown venue";

  const authors = Array.isArray(work.authorships)
    ? work.authorships
        .map(authorship => authorship.author?.display_name)
        .filter(Boolean)
        .join(", ")
    : "Unknown authors";

  const url = getBestPublicationUrl(work);

  return {
    title,
    year,
    venue,
    authors,
    url,
    source: "OpenAlex"
  };
}

function removeDuplicates(publications) {
  const map = new Map();

  for (const publication of publications) {
    const title = publication.title || "";
    const year = publication.year || "";
    const key = `${title}-${year}`.toLowerCase();

    if (!map.has(key)) {
      map.set(key, publication);
      continue;
    }

    const existing = map.get(key);

    const existingHasGoodUrl =
      existing.url &&
      existing.url !== "#" &&
      existing.url !== "javascript:void(0)";

    const newHasGoodUrl =
      publication.url &&
      publication.url !== "#" &&
      publication.url !== "javascript:void(0)";

    if (!existingHasGoodUrl && newHasGoodUrl) {
      map.set(key, publication);
    }
  }

  return Array.from(map.values());
}

app.get("/", (req, res) => {
  res.send("DeSy backend is running.");
});

app.get("/api/publications", (req, res) => {
  try {
    const publications = readLocalPublications();
    const year = req.query.year;

    if (year) {
      const filtered = publications.filter(publication => {
        return String(publication.year) === String(year);
      });

      return res.json(filtered);
    }

    res.json(publications);
  } catch (error) {
    res.status(500).json({
      message: "Could not load publications.",
      error: error.message
    });
  }
});

app.get("/api/openalex/search-author", async (req, res) => {
  try {
    const name = req.query.name;

    if (!name) {
      return res.status(400).json({
        message: "Please provide an author name using ?name="
      });
    }

    const url = new URL("https://api.openalex.org/authors");
    url.searchParams.set("search", name);
    url.searchParams.set("per_page", "5");

    const data = await fetchJson(url);

    const results = data.results.map(author => ({
      id: author.id,
      shortId: author.id.replace("https://openalex.org/", ""),
      name: author.display_name,
      works_count: author.works_count,
      cited_by_count: author.cited_by_count,
      last_known_institution:
        author.last_known_institution?.display_name || "Unknown institution"
    }));

    res.json(results);
  } catch (error) {
    res.status(500).json({
      message: "Could not search author in OpenAlex.",
      error: error.message
    });
  }
});

app.get("/api/openalex/author-works/:authorId", async (req, res) => {
  try {
    const authorId = req.params.authorId;

    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("filter", `authorships.author.id:${authorId}`);
    url.searchParams.set("sort", "publication_year:desc");
    url.searchParams.set("per_page", "20");

    const data = await fetchJson(url);
    const works = data.results.map(normalizeOpenAlexWork);

    res.json(works);
  } catch (error) {
    res.status(500).json({
      message: "Could not load author works from OpenAlex.",
      error: error.message
    });
  }
});

app.get("/api/sync-publications", async (req, res) => {
  try {
    const localPublications = readLocalPublications();
    let importedPublications = [];
    let searchedAuthors = [];

    for (const memberName of desyMembers) {
      const authorUrl = new URL("https://api.openalex.org/authors");
      authorUrl.searchParams.set("search", memberName);
      authorUrl.searchParams.set("per_page", "1");

      const authorData = await fetchJson(authorUrl);
      const author = authorData.results[0];

      if (!author) {
        searchedAuthors.push({
          name: memberName,
          status: "not found"
        });
        continue;
      }

      const authorShortId = author.id.replace("https://openalex.org/", "");

      searchedAuthors.push({
        searchedName: memberName,
        foundName: author.display_name,
        openAlexId: authorShortId,
        institution:
          author.last_known_institution?.display_name || "Unknown institution"
      });

      const worksUrl = new URL("https://api.openalex.org/works");
      worksUrl.searchParams.set(
        "filter",
        `authorships.author.id:${authorShortId}`
      );
      worksUrl.searchParams.set("sort", "publication_year:desc");
      worksUrl.searchParams.set("per_page", "10");

      const worksData = await fetchJson(worksUrl);
      const works = worksData.results.map(normalizeOpenAlexWork);

      importedPublications = importedPublications.concat(works);
    }

    const merged = removeDuplicates([
      ...localPublications,
      ...importedPublications
    ]).sort((a, b) => {
      return Number(b.year) - Number(a.year);
    });

    writeLocalPublications(merged);

    res.json({
      message: "Publications synchronized successfully.",
      searched_authors: searchedAuthors,
      imported_count: importedPublications.length,
      total_count: merged.length,
      publications: merged
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not synchronize publications.",
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`DeSy backend running at http://localhost:${PORT}`);
});