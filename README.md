# BuildersFrame 🛠️🌿

> **Credible Challenges & Hackathon Navigator for Students**  
> *From Real-World Ground-Truth to Verified Prototypes.*

BuildersFrame is an intelligent developer discovery platform engineered specifically for collegiate engineers and hackathon builders. Instead of scrolling through overwhelming lists of unverified challenges, BuildersFrame curates verified problem statements from premier collegiate competitions (such as **Smart India Hackathon**, **TNSI**, **Flipkart GRiD**, and **Major League Hacking**), pairs them with personalized tech-stack matching, and equips builders with actionable project dossiers.

---

## ✨ Key Features

- **🎯 Dedicated Minimalist Home & Central Search**: Instant search with keyboard navigation (`/`), real-time challenge suggestions, and trending challenge pills.
- **⚡ Interactive Quick Match Finder**: Live filtering by technical domain (Web, AI/ML, Embedded/IoT, Mobile, Blockchain) and experience level (Beginner, Intermediate, Advanced) with instant match count calculation.
- **📜 F-Pattern Problem Discovery Stream**: High-readability challenge cards with ground-truth facts, difficulty ratings, required skills, and previous prototype prior-art warnings.
- **🧭 Collegiate Hackathon Radar**: Live tracking of legitimate collegiate hackathons with registration deadlines, prize pools, formats (In-person, Online, Hybrid), and direct application links.
- **🧠 Personalization Match Engine**: Calculates custom affinity scores between student tech stacks and problem statement requirements.
- **🤖 Built-in AI Research Assistant**: Interactive drawer agent that conducts deep-dive technical feasibility assessments, architectural reviews, and risk analyses.
- **📋 One-Click Project Brief Export**: Generates clean, ready-to-share project blueprints for hackathon team alignment and submissions.

---

## 🎨 Design System: Sage, Sand, Cream & Ivory

BuildersFrame features a calm, luxurious, and accessible palette designed around the **60-30-10 rule**:

| Color Role | Hex Code | Visual Application |
|---|---|---|
| **Warm Ivory Cream (60%)** | `#FAF9EF` | Page canvas & background wash |
| **Muted Sage Green (30%)** | `#A3B19C` | Signature accent, pill chips, focus rings, particle nodes |
| **Warm Sand Linen (10%)** | `#DDD0C1` | Subtle card borders, badge accents, warm ambient glows |
| **Pale Mist Surface** | `#EFEFEF` | Clean card surfaces, input wells, and secondary tags |
| **Deep Forest Pine (CTA)** | `#16241B` | High-contrast primary action buttons (**14.8:1 WCAG AAA**) |

### Interactive Motion & Micro-Interactions
- **Constellation Mesh Canvas**: Floating organic particle canvas with cursor proximity line connections.
- **Hover-Reveal Details**: Minimalist card presentation at rest that smoothly expands to reveal deep technical specs on hover.
- **Celebratory Confetti**: Interactive physics-based particle celebration on bookmarking or hackathon tracking.
- **Motion Primitives Spotlight**: Dynamic radial gradient follow-cursor spotlight on featured surfaces.

---

## 📁 Repository Structure

```text
Builders_Frame/
├── backend/
│   ├── ai_engine.py       # Personalization matching & AI research agent logic
│   ├── database.py        # SQLite schema initialization & seeding
│   ├── fetcher.py         # Automated hackathon feed sync & validation
│   └── server.py          # Asynchronous Tornado HTTP API server & static host
├── data/
│   ├── seed_hackathons.json  # Curated collegiate hackathon datasets
│   └── seed_problems.json    # Government & corporate verified problem statements
├── static/
│   ├── app.js             # Client-side routing, canvas, and UI interactivity
│   ├── index.html         # Single Page Application (SPA) structure
│   └── style.css          # Design system, CSS tokens, animations & responsive layout
├── PDFs/                  # Project documentation & reference assets
├── buildersframe.db       # Local SQLite database (auto-seeded on launch)
├── .gitignore             # Standard ignore rules for macOS & Python
└── README.md              # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Standard libraries (`sqlite3`, `json`, `os`, `sys`)
- [Tornado](https://www.tornadoweb.org/) (`pip install tornado`)

### Running the Server

1. **Clone or navigate to the repository**:
   ```bash
   cd Builders_Frame
   ```

2. **Start the asynchronous Tornado server**:
   ```bash
   python3 backend/server.py
   ```

3. **Open in your browser**:
   Navigate to [http://localhost:8000](http://localhost:8000)

---

## 🛡️ License & Attribution

Developed for collegiate builders to navigate hackathons with clarity and evidence. All challenge sources and organizers (AICTE, MoE, Flipkart, MLH) retain copyright for their respective problem statements.
