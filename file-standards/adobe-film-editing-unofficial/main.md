# Adobe Post-Production Project File Specs

This document outlines the technical specifications, file formats, and primary use cases for the XML-based project formats in Adobe After Effects (**After Effects XML Project**) and Adobe Premiere Pro (**Premiere Pro Project**).

---

## 1. Adobe After Effects: `.aepx` Specification

An `.aepx` file is the text-based, XML-formatted project file variant for Adobe After Effects. It functions as a human-readable alternative to the standard binary `.aep` file.

### Key Technical Specs
* **Underlying Format:** Standard XML (Extensible Markup Language) text format.
* **Schema Dependency:** Adobe does not publish a public schema; the internal structure remains proprietary. 
* **Relationship to Binary (`.aep`):** It mirrors the exact same data hierarchy (compositions, layers, effect parameters, and keyframes) but translates the binary data into organized tags.
* **Performance Impact:** Considerably larger file size and slower to read/write relative to a standard binary `.aep` file.
* **Asset Allocation:** Does not embed source footage. It maps absolute or relative strings (file paths) pointing directly to external assets.

### Common Use Cases
* **Pipeline Automation:** Allows pipeline tools or custom Python/ExtendScript frameworks to parse and rewrite project variables (e.g., swapping footage paths, modifying text strings) without opening the GUI.
* **Version Control Integration:** Plaintext format allows versioning platforms (like Git) to run distinct line-by-line diff tracking across project variations.
* **Text Editor Auditing:** Can be opened and systematically troubleshooted inside code editors like VS Code or Notepad++.

---

## 2. Adobe Premiere Pro: `.prproj` Specification

The native equivalent file format in Premiere Pro is the `.prproj` (Premiere Pro Project) file. Unlike After Effects, Premiere Pro does not offer a separate extension for binary vs. text formats; **all `.prproj` files are text-based by default.**

### Key Technical Specs
* **Underlying Format:** GZIP-compressed XML document.
* **File Signature:** Begins natively with the classic GZIP magic bytes (`1F 8B`). 
* **Reading / Modification:** To read its raw content, the file must first be unzipped. Once decompressed, it exposes a comprehensive, plaintext XML tree structure detailing the sequences, track positions, cut boundaries, and effect configurations.
* **Asset Allocation:** Functions as an assembly "recipe." It references original external media via system directory links and does not store actual video or audio binaries inside the file.

### Common Use Cases
* **Manual Project Downgrading:** In asset-sharing bottlenecks (e.g., moving a project back from a newer release to an older software version), developers unzip the `.prproj` file, adjust the `<ProjectVersion>` integer tag within the XML root element, and re-zip the file.
* **Interoperability & Cross-Platform Offloading:** For cross-platform migration (e.g., transferring sequences to DaVinci Resolve or Final Cut Pro), Premiere Pro natively translates its internal tracking data to standard **Final Cut Pro XML (`.xml`)** data templates via `File > Export > Final Cut Pro XML`.

---

## 3. Quick Reference Matrix

| Feature / Spec | After Effects (`.aepx`) | Premiere Pro (`.prproj`) |
| :--- | :--- | :--- |
| **Primary File Extension** | `.aepx` | `.prproj` |
| **Base Language Format** | Standard XML | GZIP-Compressed XML |
| **Human Readable Instantly?**| Yes (Open with any text editor) | No (Must be decompressed first) |
| **Media Embedding?** | No (External paths only) | No (External paths only) |
| **Standard Native Variant** | Binary format (`.aep`) | None (All `.prproj` files use GZIP XML) |
| **Interchange Standard** | Interchangeable with `.aep` | Exports to Final Cut Pro XML (`.xml`) |
