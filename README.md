# LocalSEO AI

<p align="center">
  <strong>An open-source AI agent that audits, fixes and verifies SEO — built for Cameroon.</strong><br/>
  Hacktoberfest Yaoundé x Modulis · October 31, 2026
</p>

> 🇫🇷 Version française plus bas — [voir « À propos du projet »](#-à-propos-du-projet).

---

## 🇬🇧 About the project

**LocalSEO AI** is an open-source AI agent that:

1. **Audits** a website (a remote URL or a local project folder),
2. **Fixes** the SEO problems directly in the code — *only after the user validates a diff*,
3. **Re-audits** to verify that the score actually improved.

It is designed around the realities of Cameroonian developers:

- **Bilingual websites** (French / English, with `hreflang` tags),
- **WhatsApp-first** link sharing (Open Graph previews),
- **Expensive mobile data** (page-weight rules are first-class citizens).

It targets two hackathon categories: **Best Open-Source AI Project** and **Best Use of Gemma 4** — all generated text comes from **Gemma 4 via the Gemini API**.

### Core principles

- ✅ **Measured, not invented.** Every metric comes from a deterministic tool. The model never invents data.
- ✅ **Traceable data.** Every piece of information is labelled `measured`, `client` or `ai-suggestion`.
- ✅ **Nothing is modified without approval.** Diff → explicit validation → changes applied on a Git branch, with a restore point.
- ✅ **JSON-LD only from confirmed facts.** Structured data is generated exclusively from `business.json`.
- ✅ **Safe crawling.** Local/private addresses are blocked (SSRF protection) and page count is limited.

### Run an audit

The CLI audits one remote URL or up to 50 HTML files in a local project folder.
Only pass languages when the site's targets are known; `hreflang` is checked
only when more than one language is supplied.

```bash
pnpm run audit:cli -- ./path/to/site fr,en
pnpm run audit:cli -- https://example.com
```

---

## ✨ Features

**P0 — the fix loop:**

| Feature | Description |
|---|---|
| Audit | Detect missing/broken: `title`, meta description, `H1`, canonical, Open Graph & Twitter cards, alt texts, robots, sitemap, `hreflang`, image weight |
| Report | Indicative score + findings, each with its evidence (file or URL) |
| Generation | Titles, descriptions and alt texts written by Gemma 4 from page content + `business.json` |
| JSON-LD | `LocalBusiness` structured data generated from confirmed information only |
| AutoFix | Diff → validation → applied on a Git branch → new audit |
| MCP server | Tools exposed to any code agent |

**P1 — if time allows:** WhatsApp link preview, HTML report export.

---

## 🏗️ Architecture

```
CLI / MCP server → AuditModule → AiModule (Gemma 4) → FixModule (diff + Git)
                        ↓                                            ↓
                     report ←──────── re-audit (verify) ←────────────┘
```

| Module | Role |
|---|---|
| `AuditModule` | Reads the project, extracts tags, audit rules, score |
| `AiModule` | Calls Gemma 4 via the Gemini API: text, prioritisation, JSON-LD |
| `FixModule` | Creates the diff, validation, Git branch, restore |
| `McpModule` / `CliModule` | Exposes the tools, demo commands |
| `ReportModule` | Before/after report |
| `shared` | Common types and contracts |

### MCP tools

| Tool | Role |
|---|---|
| `audit_project` | Analyse a folder or URL and return an `AuditResult` |
| `generate_meta` | Ask Gemma for titles, descriptions and alt texts (FR or EN) |
| `propose_fixes` | Prepare diffs for the findings |
| `apply_fix` | Apply a validated diff on a Git branch |

---

## 🚀 Getting started

```bash
# install
pnpm install

# configure
cp .env.example .env
# → add your Gemini API key for Gemma 4 access

# run the CLI (dev mode)
pnpm run start:dev
```

### `business.json`

All generated content is anchored to confirmed business information:

```json
{
  "name": "Hôtel du Littoral",
  "city": "Kribi",
  "phone": "+237 6 99 00 00 00",
  "address": "Confirmed street address"
}
```

### Environment variables

API keys live in `.env` (never committed). A `.env.example` documents the required keys.

---

## 🎬 Demo scenario (2 minutes)

1. The deliberately-bad test site (a hotel in Kribi) and its low initial score.
2. One command / MCP call: *“audit and fix this site — change nothing before my validation.”*
3. Findings are displayed with their evidence.
4. Gemma writes the missing content; the agent shows the diff.
5. The user validates; changes are applied on a Git branch.
6. New audit: the score goes up. Git restore is always possible.

---

## 🗺️ Tech stack

- **NestJS + TypeScript** — HTTP client + HTML parsing for crawling (no headless browser needed for the demo)
- **Gemma 4 via Gemini API** — content generation and prioritisation
- **JSON files + Git** — no database required
- **Model Context Protocol (MCP)** — agent integration

---

## 🤝 Contributing

- One file = one owner. Ask before touching someone else's file.
- Work on `feature/audit`, `feature/ai` or `feature/demo` branches; merge to `main` frequently.
- Keys go in `.env` — never commit them; update `.env.example` instead.

## 🆓 License

Released under the [MIT License](LICENSE) — © 2026 AIO.

---

---


# 🇫🇷 À propos du projet

**LocalSEO AI** est un agent IA open source qui :

1. **Audite** un site web (URL distante ou dossier de projet local),
2. **Corrige** les problèmes de référencement directement dans le code — *après validation du diff par l'utilisateur*,
3. **Ré-audite** pour vérifier que le score s'est réellement amélioré.

Il est conçu pour les développeurs camerounais :

- **Sites bilingues** (français / anglais, balises `hreflang`),
- **Partage de liens sur WhatsApp** (aperçus Open Graph),
- **Données mobiles coûteuses** (le poids des pages est une règle de premier plan).

Catégories visées : **Best Open-Source AI Project** et **Best Use of Gemma 4** — tout le contenu généré provient de **Gemma 4 via l'API Gemini**.

### Principes fondamentaux

- ✅ **Mesuré, jamais inventé.** Chaque métrique provient d'un outil déterministe.
- ✅ **Données traçables.** Chaque information est étiquetée `measured`, `client` ou `ai-suggestion`.
- ✅ **Rien n'est modifié sans validation.** Diff → validation explicite → application sur une branche Git, avec point de restauration.
- ✅ **JSON-LD uniquement à partir de faits confirmés.** Généré exclusivement depuis `business.json`.
- ✅ **Exploration sécurisée.** Blocage des adresses locales/privées (SSRF) et limite du nombre de pages.

### Contenu généré (F04 — P0)

Titres, descriptions et textes alternatifs rédigés par Gemma 4 à partir du contenu de la page et de `business.json`, en français ou en anglais ; données structurées `LocalBusiness` (JSON-LD) à partir d'informations confirmées.

### Démarrage rapide

```bash
pnpm install
cp .env.example .env   # clé API Gemini pour Gemma 4
pnpm run start:dev
```

### Licence

Publié sous [licence MIT](LICENSE) — © 2026 AIO.
