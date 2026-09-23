# Cyber Mindscape Portfolio v3 — Experimental Security Lab

This release extends the existing GitHub Pages portfolio with three fully static, client-side experiments.

## New pages

- `bytewitness.html` + `bytewitness.js` — privacy-first static digital forensics
- `morph-node.html` + `morph-node.js` — abstract IoT / cyber-physical threat model
- `safecircle.html` + `safecircle.js` — cooperative human-security scenarios

The homepage now includes an **Experimental Security Lab** section linking to all three tools.

## GitHub Pages compatibility

No server, database, API key, package manager, build step, or external JavaScript library is required. Upload the files directly to the root of `rbcommoncents.github.io` and commit to `main`.

Keep:
- `CNAME` with `ryszard-bialach2.com`
- `.nojekyll`
- GitHub Pages source: `main` / root
- Enforce HTTPS enabled

## ByteWitness privacy model

ByteWitness reads the selected file using browser APIs. The file is not intentionally transmitted to the site owner or a third-party service. The public build limits analysis to 64 MB for browser stability and performs static inspection only.

Supported v1 observations include:
- extension vs magic bytes
- SHA-256 and SHA-1
- ASCII and UTF-16LE strings
- overall and block entropy
- embedded signatures
- validated PE-like structures using MZ + e_lfanew + PE\0\0
- PDF action markers and bytes after `%%EOF`
- PNG chunks and data after `IEND`
- JPEG data after EOI
- image least-significant-bit visualizations
- WAV RIFF chunks / bytes beyond declared container
- MP3 ID3 size, FLAC/Ogg/MP4-style identification

It intentionally does not execute files or claim that a finding proves maliciousness.

## MORPH//NODE safety boundary

The 3-D object is an abstract security visualization. It contains no dimensions, propulsion design, construction steps, control code, or other instructions for building a dangerous autonomous device.

## SafeCircle

SafeCircle focuses on defensive social patterns: independent verification, supportive reporting, removing shame, protecting accounts, and cooperative escalation.


## Responsible & Trusted Use gate

- policy page: `trusted-use.html`
- policy version: `2026-09-v1`
- first-time human visitors must acknowledge the policy before entering
- acceptance is stored client-side in `localStorage`
- no account or backend tracking is required
- the old Skip Animation bypass is removed
- underlying HTML remains crawlable for SEO
- footer links expose Responsible Use, Privacy, and Security information
- the policy page uses `noindex,follow` so it does not compete with portfolio pages in search
