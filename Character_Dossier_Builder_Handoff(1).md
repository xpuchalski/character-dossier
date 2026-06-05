# Character Dossier Builder
## Project Handoff Document

### Project Summary

A GitHub Pages-hosted web application for creating, organizing, and exporting character profiles.

The project is designed for writers, roleplayers, worldbuilders, game developers, and artists who need a flexible character creation tool that is more powerful than a traditional character sheet but simpler than a wiki.

The application is entirely client-side.

No accounts.
No backend.
No server database.

All data is stored locally in the browser and can be exported/imported as JSON.

---

# Core Goals

1. Work entirely on GitHub Pages.
2. Require no server infrastructure.
3. Save data automatically on the user's device.
4. Allow complete customization of character sheets.
5. Support image galleries.
6. Support visual relationship mapping.
7. Support visual timelines.
8. Support JSON and PDF export.
9. Support multiple characters with search and organization tools.

---

# Recommended Technology Stack

## Framework

React + TypeScript

Reasons:

- Strong component architecture
- Easy state management
- Large ecosystem
- Easy future expansion

## Storage

IndexedDB

Recommended library:

Dexie.js

Reasons:

- Works entirely client-side
- Supports large datasets
- Supports image storage
- Supported on GitHub Pages

Do NOT use cookies.

localStorage is acceptable for settings and preferences.

Character data should be stored in IndexedDB.

## Styling

Tailwind CSS

## Drag and Drop

dnd-kit

## PDF Export

pdf-lib

## Build Tool

Vite

## Hosting

GitHub Pages

---

# Data Storage

Characters are stored locally.

Each character should be represented as a JSON object.

Example:

```ts
Character {
  id: string
  name: string

  basicInfo: {
    birthday: string
    age: string
    gender: string
    height: string
    weight: string
  }

  images: Image[]

  biography: string

  customSections: Section[]

  relationships: Relationship[]

  timeline: TimelineEvent[]

  tags: string[]

  notes: string

  createdAt: Date
  updatedAt: Date
}
```

---

# Layout

## Left Sidebar

Persistent sidebar similar to ChatGPT.

Contains:

- Character list
- Search bar
- Create character button
- Delete character button
- Import JSON button

Features:

- Search by name
- Search by tags
- Sort alphabetically
- Sort by recently edited

---

## Main Character Page

### Section 1: Identity

Default fields:

- Name
- Birthday
- Age
- Gender
- Pronouns (optional)
- Species (optional)
- Occupation (optional)

---

### Section 2: Gallery

Appears directly below identity.

Supports:

- Drag-and-drop upload
- Multiple images
- Reordering images
- Captions (optional)

Suggested views:

- Grid View
- Large Preview View

---

### Section 3: Biography

Large markdown-enabled text area.

Used for:

- Backstory
- Personality
- Lore
- History

---

### Section 4: Relationship Map

Visual node graph.

Center node:

Character name.

Additional nodes:

Relationship entries.

Example:

Ryan
Friend
Blue connection line

Commander
Mentor
Green connection line

Rival
Red connection line

Features:

- Drag nodes
- Color-coded relationships
- Relationship labels
- Notes per relationship

Possible relationship colors:

- Friend = Blue
- Family = Green
- Rival = Red
- Romantic = Pink
- Enemy = Orange

Colors should be customizable.

Recommended library:

React Flow

---

### Section 5: Timeline

Visual timeline component.

Users can add events.

Example:

2014 - Joined military

2018 - Met Ryan

2022 - Lost eye

Features:

- Chronological display
- Vertical timeline
- Optional images
- Optional event icons

Recommended visualization:

Interactive timeline rather than plain text.

---

### Section 6: Custom Sections

Most important feature.

User clicks:

+ Add Section

Creates:

Title field

Content field

Examples:

Magic System

Equipment

Abilities

Favorite Foods

Quotes

Trivia

Anything else.

Requirements:

- Rename section
- Delete section
- Collapse section
- Reorder section

Drag-and-drop ordering preferred.

---

# Export System

## JSON Export

Highest priority.

Exports complete character.

Purpose:

- Backups
- Sharing
- Migration

Must support import.

---

## PDF Export

Generates printable character sheet.

Includes:

- Basic info
- Gallery
- Biography
- Relationships
- Timeline
- Custom sections

---

# Search System

Search should support:

- Name
- Tags
- Section titles

Optional future support:

- Full-text search

---

# Settings

Store in localStorage.

Examples:

- Theme
- Sidebar width
- Grid size
- Relationship colors

---

# Future Features

Not required for Version 1.

Possible additions:

- Character templates
- World database
- Character linking
- Folders
- Collections
- Timeline filtering
- Version history
- PNG export
- Offline installation as a PWA

---

# Version 1 Scope

Must Have:

- Character creation
- Sidebar navigation
- Search
- Gallery
- Biography
- Custom sections
- Relationship graph
- Timeline
- IndexedDB saving
- JSON export/import
- PDF export

Everything else is optional.

---

# Design Philosophy

The application should feel like a hybrid between:

- A wiki page
- A character sheet
- A visual planning board

Users should never feel restricted by a predefined template.

The system should provide useful defaults while allowing complete customization.


---

# Character Themes and Customization

This is considered a Version 1 feature.

Users should be able to customize the appearance of individual character pages without editing code.

## Per-Character Themes

Each character may have its own visual theme.

Theme settings:

- Primary Color
- Secondary Color
- Accent Color
- Background Color
- Text Color

These settings should affect:

- Headers
- Cards
- Buttons
- Relationship graph colors (optional)
- Timeline styling (optional)

This allows every character dossier to have a unique visual identity.

Example:

Selene:
- Dark background
- Crimson accent

Ryan:
- Blue accent
- Light background

## Character Banner

Each character can optionally have a banner image displayed at the top of the page.

Suggested layout:

Banner
↓
Identity Information
↓
Gallery
↓
Biography
↓
Relationships
↓
Timeline
↓
Custom Sections

## Future Theme Expansion

Not required for Version 1.

Potential additions:

- Font selection
- Layout presets
- Border radius controls
- Shadow controls
- Transparency controls
- Custom card styles

## Advanced Mode

Future feature.

Power users may optionally provide custom CSS snippets.

This should be disabled by default and hidden behind an advanced settings menu.

Version 1 should focus on color customization rather than arbitrary CSS editing.

