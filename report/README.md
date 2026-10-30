# LaTeX report starter

Edit `report.tex` and `references.bib`. The section prompts in square brackets are drafting notes; replace or remove them before submission. The sample bibliography entry is deliberately fictional and must not be cited in a submitted report.

## Compile locally

Install a LaTeX distribution (TeX Live or MiKTeX) and a LaTeX editor (for example, TeXstudio), or use Overleaf in a browser. For this BibLaTeX setup, compile in this order:

```text
pdflatex report.tex
bibtex report
pdflatex report.tex
pdflatex report.tex
```

The resulting PDF is `report.pdf`. In VS Code with LaTeX Workshop, use the `latexmk` build command after TeX Live's `bin` folder is on your `PATH`.

## Page planning

For 10–15 pages of main text, a reasonable first draft allocation is: introduction/objectives 1–2 pages; literature review 3–4; progress and alternatives 3–5; next-semester plan 1–2; conclusion 0.5–1. Check whether your course counts the title page, contents, figures, and references in its page limit. Follow your department's required citation style and formatting if they differ from this starter.
