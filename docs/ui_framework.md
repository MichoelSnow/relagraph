# UI Framework: Relational Graph Explorer

## Overview

This document defines the UI framework for a temporal, relational graph application.
The primary interaction model is an **ego-centric graph explorer** with integrated time controls and inline editing.

The UI is designed to:
- Prioritize relational understanding over temporal analysis
- Scale with graph size via progressive expansion
- Support both exploration and editing in a unified interface

---

## Core Principles

### 1. Graph-First Navigation
The graph is the primary interface for understanding and interacting with data.

### 2. Ego-Centric Expansion
Users begin from a central node and expand outward incrementally.

### 3. Temporal Awareness (Not Dominance)
Time is integrated via a global slider but does not dominate the UI.

### 4. Separation of Navigation and Editing
- Graph = navigation and structure
- Side panel = detailed editing and inspection

### 5. Progressive Disclosure
Only show what the user needs at any moment to avoid overload.

---

## Main Layout

### Center: Graph View
- Interactive node-link graph
- Nodes represent entities
- Edges represent relationships
- Expand/collapse behavior

### Top: Time Controls
- Global time slider
- Play/pause (animated playback)
- Optional date input

### Side Panel (Right Recommended)
- Node details
- Relationship details
- Editing interface

### Opposite Panel (Left Recommended)
- Filters
  - Entity type
  - Relationship type
  - Temporal state

---

## Graph Interaction Model

### Node Interactions
- Click: expand direct relationships
- Click again: collapse
- Hover: preview info
- Select: open detail panel

### Edge Interactions
- Click: open relationship details
- Hover: show type, dates

### Expansion Rules
- Only expand one degree at a time
- Allow multi-level expansion explicitly
- Always allow collapse

---

## Temporal Interaction

### Global Time Slider
- Filters graph to active relationships at time T
- Smooth transitions between states

### Playback Mode
- Animates slider progression
- Useful for storytelling and exploration

### Temporal Logic
- Show active relationships prominently
- Optionally fade past relationships

---

## Filtering System

### Entity Filters
- Person
- Animal
- Place

### Relationship Filters
- Romantic
- Familial
- Friendship
- Pet-related

### Temporal Filters
- Active only
- Include past
- Include all

### Behavior
- Filters hide edges first
- Orphaned nodes are removed afterward

---

## Editing Model

### In-Graph Editing
- Create relationships
- Connect nodes
- Quick edits

### Side Panel Editing
- Full form-based editing
- Relationship types and roles
- Temporal intervals
- Metadata

---

## Detail Panel

### Node View
- Names
- Attributes
- Relationships
- Media

### Relationship View
- Type
- Participants + roles
- Time intervals
- Events

---

## Performance & Scaling

- Limit automatic expansion
- Lazy-load nodes and edges
- Use clustering or grouping if needed
- Prevent rendering overload

---

## Future Enhancements

- Timeline view (secondary)
- Subgraph focus mode
- Advanced filtering
- AI-assisted tagging and suggestions

---

## Summary

This UI framework enables:
- Scalable graph exploration
- Clear relational understanding
- Integrated temporal awareness
- Controlled editing experience

It is designed to evolve while maintaining clarity and usability.
