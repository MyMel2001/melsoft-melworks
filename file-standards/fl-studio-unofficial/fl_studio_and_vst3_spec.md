# Unofficial FL Studio Project (.flp) & VST3 Plugin Specification

This document details the reverse-engineered, unofficial technical specifications for the **FL Studio Project Format (`.flp`)** and the mechanisms utilized by advanced third-party vocal synthesis plugins (such as **Dreamtonics Synthesizer V** and **Yamaha VOCALOID**) to integrate their states via the **VST3 framework**.

---

## 1. The `.flp` Project Format Architecture

An `.flp` file is a **strictly binary, event-streamed container**. Rather than using a database, tabular schema, or XML/JSON trees, it reads sequentially as a linear series of system commands. It relies on a customized implementation of **Type-Length-Value (TLV) encoding**.

### File Chunk Topology

An `.flp` file is divided structurally into two explicit blocks:

```
┌────────────────────────────────────────────────────────┐
│                      HEADER CHUNK                      │
│  "FLhd" Magic ──► Size (6 Bytes) ──► Format/PPQ Data   │
├────────────────────────────────────────────────────────┤
│                       DATA CHUNK                       │
│  "FLdt" Magic ──► Size (4 Bytes) ──► Continuous Stream │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │ EVENT 1: Type Byte (0-191) ──► Fixed Value     │   │
│   ├────────────────────────────────────────────────┤   │
│   │ EVENT 2: Type Byte (192-255) ──► Varint Length │   │
│   │          └──► String / VST State Binary Blob   │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

#### A. Header Chunk (`FLhd`)
* **Magic Bytes:** Always begins with the 4-byte ASCII magic string `FLhd` (`46 4C 68 64`).
* **Chunk Size:** A 32-bit little-endian integer declaring the size of the remaining header payload (typically fixed to `6` bytes).
* **Payload:** 
  * Format type (16-bit integer).
  * Channel count (16-bit integer).
  * Project **PPQ (Pulses Per Quarter Note)** resolution (16-bit integer).

#### B. Data Chunk (`FLdt`)
* **Magic Bytes:** Follows immediately with the 4-byte ASCII magic string `FLdt` (`46 4C 64 74`).
* **Chunk Size:** A 32-bit little-endian integer declaring the absolute payload length of the remaining project bytes.
* **Payload:** The flat, uninterrupted stream of sequential events that define the project state.

### The TLV Event Processing Engine

The parser processes the event stream byte-by-byte. The leading byte of an event functions as an **Event ID** which dictates how the remaining payload of that event must be measured:

* **Fixed-Size Data (IDs `0` to `191`):** The Event ID maps to a predefined data size. The parser automatically reads the next 1, 2, 4, or 8 bytes to evaluate standard primitives like panning values, track volumes, mixer routing, or BPM toggles.
* **Variable-Length Data (IDs `192` to `255`):** Reserved for text strings, absolute file paths, and massive plugin state properties. The parser reads a variable-length integer (**Varint**) directly after the ID to determine the exact number of subsequent bytes to digest.

---

## 2. Third-Party Plugin Integration Specs (VST3)

Virtual instruments like Synthesizer V Studio Pro or VOCALOID load inside the DAW via Steinberg's **VST3 (`.vst3`)** Component Object Model (COM) interface. When the host project file compiles, it flattens the active configurations of these complex external engines directly into the `.flp` event stream.

### The VST Configuration Vector

When a high-index Event ID signaling an external instrument parameters block is reached, the `.flp` data stream exposes a specialized VST wrapper structure:

| Field Element | Data Type / Scope | Purpose / Function |
| :--- | :--- | :--- |
| **Plugin UID** | 16-Byte Hex Code | Unique Class ID (CID) used by the DAW to target the precise VST3 plugin installation locally. |
| **VST3 Category ID** | 4-Byte ASCII | Specifies if the host treats the plugin as a Generator/Instrument (`"Vstg"`) or an Effect (`"Vstf"`). |
| **State Buffer Size** | 32-Bit Varint | Declares the exact byte length of the trailing unformatted binary block. |
| **Opaque Data Blob** | Binary Array | The raw internal state of the plugin, passed directly to the plugin without DAW interpretation. |

### Vocal Synthesis State Injection Engines

Because modern vocal software must track lyrical data, pitch curves, phoneme timbres, and complex AI singer voice assignments that transcend simple MIDI data, plugins utilize one of two operational methods inside the VST Opaque Data Blob:

```
[ .flp Event Stream ] ──► [ Event ID 224: VST Block ] 
                                  │
       ┌──────────────────────────┴──────────────────────────┐
       ▼                                                     ▼
 [ Model A: Full State Embedding ]             [ Model B: External File Linking ]
  - Complete XML/JSON data of strings           - Stores project pointer string
  - Lyrics, track nodes, and parameters          - Links directly to local asset
  - Saved directly inside host blob             - Example: "C:/VocalProjects/VocalTrack.svp"
```

1. **Full State Embedding (Monolithic)**
   The plugin serializes its entire engine layout—including notes, lyrics, micro-tonal pitch micro-edits, and rendering parameters—into a structural text layout (such as the raw **JSON** format native to `.svp` Synthesizer V projects). This text block is zipped or raw-buffered straight into the DAW's binary data block.
2. **External Resource Linking (Referential)**
   To optimize auto-saving intervals and prevent the `.flp` file from bloating into hundreds of megabytes, the plugin writes a system directory string pointing to an external project archive (e.g., a native `.svp` or `.vsqx` file). When the host project initializes, the plugin parses this pointer path to reconstruct its contents.

---

## 3. Quick Reference Matrix

| Feature / Architectural Layer | Project Domain (`.flp`) | Plugin Bridge Domain (`.vst3`) |
| :--- | :--- | :--- |
| **Structural Design Pattern** | Event-Driven Type-Length-Value Stream | Component-Object Model (C++ COM Interfaces) |
| **Immediate Legibility** | No (Binary; requires specialized parsing tools) | No (Binary compilation wrapping plugin state) |
| **Asset Dependencies** | Audio/Samples tracked by relative/absolute paths | Audio components handled by external plugin engine |
| **State Extraction Method** | Sequential scanning of `FLdt` block tokens | Querying via `IComponent::getState()` interface |