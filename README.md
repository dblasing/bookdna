# BookDNA™

**Upload your Goodreads reading history. Discover the genetic code of your literary taste.**

BookDNA is a single-file web app that parses your Goodreads CSV export and generates an interactive "DNA map" of your reading life — clustered by genre, sized by volume, and powered by AI recommendations.

🔗 **Live demo:** [dblasing.github.io/bookdna](https://dblasing.github.io/bookdna)

---

## What it does

- Parses your Goodreads library export (`.csv`)
- Detects genres from titles, authors, and shelf tags
- Renders an interactive bubble map — each bubble is a genre cluster
- Bubble **size** reflects how many books you've read in that genre
- **Click any bubble** to see your top-rated books in that genre and get 5 AI-powered recommendations of books you haven't read yet
- Recommendations are generated live by Claude (Anthropic's AI) based on your actual reading history
- Click any recommendation to search it on Goodreads

---

## How to use it

### Step 1 — Export your Goodreads library

1. Go to [goodreads.com](https://www.goodreads.com) and sign in
2. Navigate to **My Books**
3. Click **Import and Export** (bottom of the left sidebar)
4. Click **Export Library**
5. Wait for the export to generate, then download the `.csv` file

### Step 2 — Upload to BookDNA

1. Open [dblasing.github.io/bookdna](https://dblasing.github.io/bookdna)
2. Drag and drop your `.csv` file onto the upload zone, or click **Choose File** and select it
3. BookDNA will analyze your library (takes a few seconds)

### Step 3 — Explore your map

- **Scroll** to zoom in and out
- **Drag** to pan around the map
- **Click any bubble** to open the genre panel
- In the panel, scroll down past your books to see **AI recommendations**
- Click a recommendation to search for it on Goodreads

---

## Tech stack

- Pure HTML, CSS, and JavaScript — no build step, no dependencies, no framework
- Canvas-based interactive visualization
- Anthropic Claude API (`claude-sonnet-4-6`) for real-time book recommendations
- Hosted on GitHub Pages

---

## Running locally

Since this is a single HTML file, just open it:

```bash
git clone https://github.com/dblasing/bookdna.git
cd bookdna
open index.html
```

> **Note:** The AI recommendations require a browser environment that proxies requests to the Anthropic API. They work on the hosted GitHub Pages version. If running locally and recommendations don't load, that's expected — everything else works fine.

---

## Genre detection

BookDNA detects genres by scanning book titles, author names, and your Goodreads shelf tags for keywords. Supported genres include:

Literary Fiction · Mystery & Thriller · Sci-Fi & Speculative · Fantasy & Magic · Biography & Memoir · History · Business & Finance · Self-Help & Growth · Psychology · Philosophy · Science & Nature · Romance · Graphic & Comics · Young Adult · Politics & Society · Travel & Adventure · Art & Culture · Food & Cooking · Spirituality · Technology

Books that don't match a known genre are grouped under **General Fiction**.

---

## Privacy

Your Goodreads data never leaves your browser. The CSV is parsed entirely client-side. The only outbound request is to the Anthropic API to generate recommendations — it receives your genre name and a list of book titles, nothing else.

---

## Credits

Built with [Claude](https://claude.ai) by Daniel Blasingame.
