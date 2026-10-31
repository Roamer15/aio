# CLI Tools for LocalSEO AI

This directory contains the CLI tools for demonstrating LocalSEO AI capabilities.

## Running the Audit

### Run the TypeScript CLI
```bash
pnpm run audit:cli -- ./path/to/site
pnpm run audit:cli -- ./path/to/site fr,en
pnpm run audit:cli -- https://example.com
```

## Audit Command Options

- **Target**: Required - Either a folder path (e.g., `./site`) or a URL (e.g., `https://example.com`)
- **Languages**: Optional - Comma-separated list of known target languages (`fr`, `en`). The `hreflang` rule is skipped unless multiple languages are provided.

## What it does

The audit command:
1. Loads one remote page or up to 50 HTML files from a local folder
2. Performs deterministic SEO analysis using 11 rules
3. Generates an indicative score (0-100)
4. Outputs findings with measured evidence

## Output Format

The audit outputs:
- **Score**: A numerical rating (higher is better)
- **Findings**: List of detected issues with severity level (🔴 high, 🟡 medium, 🟢 low)
- **Evidence**: Measured proof for each finding (counts, file paths, etc.)
- **File or URL references**: The local file or remote URL where the issue was found

## Example Output

```
📊 AUDIT RESULT
   Target: ./site
   Indicative score: 8/100

   🚨 12 issue(s):
   1. 🔴 missing-title
      No <title> element found in <head>.
      📁 ./index.html

   2. 🟡 missing-h1
      2 <h1> headings found on this page.
      📁 ./index.html
   ...
```

## Development Notes

- The audit runs against a deliberately-bad test site (a hotel in Kribi)
- All analysis is deterministic — no model invented data
- The tool respects the hackathon constraints (no databases, SSRF protection)
- Image weight is measured only when actually measured (no guessing)

## Testing locally

You can test the audit with a sample folder:

```bash
mkdir -p test-site
cat > test-site/index.html <<EOF
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body>
  <h1>Welcome</h1>
  <img src="photo.jpg">
  <img src="logo.png" alt="">
</body>
</html>
EOF

pnpm run audit:dev ./test-site
```

## Important

- The audit is **indicative** only — it measures issues but doesn't promise Google rankings
- All modifications require explicit user validation and Git branching
- The tool is designed for Cameroonian developers (bilingual, WhatsApp-aware)
- Open source under MIT license