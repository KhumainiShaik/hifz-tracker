# Quran structural metadata

Source: Tanzil Project, [Quran Metadata](https://tanzil.net/docs/Quran_Metadata), metadata version 1.0.
Original download: https://tanzil.net/res/text/metadata/quran-data.xml

The unmodified source is retained at `src/data/quran-data.xml`. Its root declares:
`copyright="(C) 2008-2009 Tanzil.info" license="cc-by"`.

This is Creative Commons Attribution metadata. The original metadata declares `cc-by` without a version; we preserve that notice rather than inventing a version. Tanzil's documented [text license](https://tanzil.net/docs/text_license) is CC BY 3.0 with additional Quran-text preservation terms; this application ships structural metadata, **not Quran verse text**. Credit and a link to Tanzil appear in the app and must remain with redistributed data. See [Creative Commons Attribution](https://creativecommons.org/licenses/by/3.0/) for the project's published attribution-license reference.

`src/data/quran.json` is a mechanically extracted subset: chapter number, names, counts, offsets, Juz boundaries, and page boundaries. No boundary or count is altered. Regenerate with `npm run metadata:generate`. Names retain Tanzil's transliteration. The extractor and tests verify 114 Surahs, 6,236 ayahs, 30 Juz, 604 pages, contiguous offsets, and full coverage.

Page references apply exclusively to the [Medina Mushaf](https://tanzil.net/docs/medina_mushaf), 604 pages, Hafs numbering, as mapped by this dataset. They do not apply to Indo-Pak, Warsh, or other page layouts. Users can hide page references. Surahs and Juz are never treated as equal-sized ayah groups.

Lucide icons: ISC license, https://lucide.dev/license.
React, Vite, Tailwind CSS, React Router, Zod, Vitest, and related dependencies retain their package licenses. Firebase client and tools use their published Apache-2.0 licenses. See the lockfile and installed package notices.
