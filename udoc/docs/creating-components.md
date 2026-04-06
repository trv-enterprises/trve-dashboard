---
sidebar_position: 10
---

# Creating Components

There are three ways to create components:

## 1. Manual Editor

Open the component editor from either:
- Design Mode > Components > **Create** button
- Dashboard edit mode > Panel header > Edit icon > **New Component**

The editor provides a form-based interface:

1. **Select component type** (Chart, Control, or Display)
2. **Select sub-type** (e.g., Bar chart, Toggle control)
3. **Enter name and description**
4. **Select a connection** (data source)
5. **Configure query** (SQL, API params, etc.)
6. **Set data mapping** (map query fields to chart axes)
7. **Adjust options** (colors, labels, thresholds)
8. **Preview** the component with live data

Click **Save** to create the component.

## 2. AI Builder

Create components through natural language conversation with an AI assistant:

1. Launch from Design Mode > Components > Create > **Create with AI**
2. Or from a dashboard panel > Edit icon > **New with AI**
3. A pre-flight dialog gathers context (component type, connection)
4. The AI builder opens with a split layout: chat (left) + preview (right)

See [AI Component Builder](ai-builder.md) for the full workflow.

## 3. Select Existing

Reuse a component from the library:

1. From a dashboard panel > Edit icon > **Select Existing**
2. Browse or search the component library
3. Filter by category (Charts, Controls, Displays)
4. Click a component to select it, then confirm

The selected component is assigned to the panel. The panel auto-expands to meet the component's minimum size.

## Editing Existing Components

From the component list or a dashboard panel:

- **Edit Component** opens the manual editor
- **Edit with AI** opens the AI builder with the existing component loaded

Changes to a component update it everywhere it's used.

---
