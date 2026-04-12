// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package registry

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

// Catalog is the unified, read-only view of every user-facing type the
// dashboard knows about. Both the MCP server and the AI builder system
// prompt read from this structure so there is exactly one source of truth.
//
// Connection types come from the adapter registry (registry.List()).
// Component types come from the component registry (ListComponentTypes()).
// Device types come from a DB-backed lister supplied at call time — the
// registry package intentionally has no hard dependency on service/models.
type Catalog struct {
	ConnectionTypes []TypeInfo          `json:"connection_types"`
	ChartTypes      []ComponentTypeInfo `json:"chart_types"`
	ControlTypes    []ComponentTypeInfo `json:"control_types"`
	DisplayTypes    []ComponentTypeInfo `json:"display_types"`
	DeviceTypes     []DeviceTypeSummary `json:"device_types"`
}

// DeviceTypeSummary is the minimal, serializable slice of a DeviceType that
// the catalog exposes. The real model lives in internal/models but the
// registry package avoids depending on it so there are no import cycles —
// the lister returns this shape directly.
type DeviceTypeSummary struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Description    string   `json:"description,omitempty"`
	Category       string   `json:"category,omitempty"`
	Protocol       string   `json:"protocol,omitempty"`
	SupportedTypes []string `json:"supported_types,omitempty"`
	IsBuiltIn      bool     `json:"is_built_in"`
}

// DeviceTypeLister is the minimal interface the catalog needs. Concrete
// implementations adapt DeviceTypeService or a test fake.
type DeviceTypeLister interface {
	ListDeviceTypesForCatalog(ctx context.Context) ([]DeviceTypeSummary, error)
}

// BuildCatalog assembles the unified type catalog. Pass nil for deviceTypes
// to omit them (useful in tests or contexts where DB access isn't available).
func BuildCatalog(ctx context.Context, deviceTypes DeviceTypeLister) (*Catalog, error) {
	cat := &Catalog{
		ConnectionTypes: List(),
		ChartTypes:      ListComponentTypes(CategoryChart),
		ControlTypes:    ListComponentTypes(CategoryControl),
		DisplayTypes:    ListComponentTypes(CategoryDisplay),
	}
	if deviceTypes != nil {
		dts, err := deviceTypes.ListDeviceTypesForCatalog(ctx)
		if err != nil {
			return nil, fmt.Errorf("list device types: %w", err)
		}
		cat.DeviceTypes = dts
	}
	return cat, nil
}

// RenderMarkdown produces a compact markdown description of the catalog
// suitable for embedding in an LLM system prompt. Hidden component types
// are skipped.
func (c *Catalog) RenderMarkdown() string {
	var sb strings.Builder

	sb.WriteString("## Connection types\n\n")
	sb.WriteString("Each connection type requires a different `config` sub-document. Use `list_connections` to see configured connections and `get_connection_schema` to discover the data shape of an existing connection.\n\n")
	if len(c.ConnectionTypes) == 0 {
		sb.WriteString("_(none registered)_\n\n")
	} else {
		for _, t := range c.ConnectionTypes {
			writeConnectionType(&sb, t)
		}
	}

	sb.WriteString("## Chart types\n\n")
	sb.WriteString("These are the canonical `chart_type` values. Use `chart.custom` with `use_custom_code: true` for anything outside this list — the React component path can render any ECharts type or custom visualization bundled with the client.\n\n")
	writeComponentTypes(&sb, c.ChartTypes)

	sb.WriteString("## Control types\n\n")
	sb.WriteString("Interactive controls. Writable controls that bind to a connection also need a `device_type_id` so the server knows how to translate user actions into wire-format commands.\n\n")
	writeComponentTypes(&sb, c.ControlTypes)

	sb.WriteString("## Display types\n\n")
	sb.WriteString("Non-chart visual components bundled with the frontend (Frigate viewers, weather, etc).\n\n")
	writeComponentTypes(&sb, c.DisplayTypes)

	if len(c.DeviceTypes) > 0 {
		sb.WriteString("## Device types\n\n")
		sb.WriteString("User-managed device definitions stored in MongoDB. Each has a command schema used by controls; `supported_types` lists which control subtypes can bind to it.\n\n")
		dts := make([]DeviceTypeSummary, len(c.DeviceTypes))
		copy(dts, c.DeviceTypes)
		sort.Slice(dts, func(i, j int) bool { return dts[i].ID < dts[j].ID })
		for _, dt := range dts {
			fmt.Fprintf(&sb, "- **`%s`** — %s", dt.ID, dt.Name)
			if dt.Category != "" {
				fmt.Fprintf(&sb, " (%s", dt.Category)
				if dt.Protocol != "" {
					fmt.Fprintf(&sb, "/%s", dt.Protocol)
				}
				sb.WriteString(")")
			}
			if len(dt.SupportedTypes) > 0 {
				fmt.Fprintf(&sb, " — supports: %s", strings.Join(dt.SupportedTypes, ", "))
			}
			if dt.Description != "" {
				fmt.Fprintf(&sb, "\n  %s", dt.Description)
			}
			sb.WriteString("\n")
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

func writeConnectionType(sb *strings.Builder, t TypeInfo) {
	fmt.Fprintf(sb, "- **`%s`** — %s", t.TypeID, t.DisplayName)
	var caps []string
	if t.Capabilities.CanRead {
		caps = append(caps, "read")
	}
	if t.Capabilities.CanWrite {
		caps = append(caps, "write")
	}
	if t.Capabilities.CanStream {
		caps = append(caps, "stream")
	}
	if len(caps) > 0 {
		fmt.Fprintf(sb, " (%s)", strings.Join(caps, ", "))
	}
	sb.WriteString("\n")

	if len(t.ConfigSchema) > 0 {
		sb.WriteString("  - Config fields: ")
		fields := make([]string, 0, len(t.ConfigSchema))
		for _, f := range t.ConfigSchema {
			marker := ""
			if f.Required {
				marker = "*"
			}
			fields = append(fields, fmt.Sprintf("`%s`%s", f.Name, marker))
		}
		sb.WriteString(strings.Join(fields, ", "))
		sb.WriteString(" (`*` = required)\n")
	}
}

func writeComponentTypes(sb *strings.Builder, types []ComponentTypeInfo) {
	visible := make([]ComponentTypeInfo, 0, len(types))
	for _, t := range types {
		if !t.Hidden {
			visible = append(visible, t)
		}
	}
	if len(visible) == 0 {
		sb.WriteString("_(none registered)_\n\n")
		return
	}
	for _, t := range visible {
		fmt.Fprintf(sb, "- **`%s`** — %s", t.Subtype, t.DisplayName)
		var caps []string
		if t.Capabilities.CanRead {
			caps = append(caps, "read")
		}
		if t.Capabilities.CanWrite {
			caps = append(caps, "write")
		}
		if t.Capabilities.RequiresDeviceType {
			caps = append(caps, "needs device_type")
		}
		if len(caps) > 0 {
			fmt.Fprintf(sb, " (%s)", strings.Join(caps, ", "))
		}
		sb.WriteString("\n")
		if t.Description != "" {
			fmt.Fprintf(sb, "  %s\n", t.Description)
		}
		if t.DataRequirements != nil && (t.DataRequirements.RequiresXAxis || t.DataRequirements.RequiresYAxis) {
			sb.WriteString("  Data: ")
			var parts []string
			if t.DataRequirements.RequiresXAxis {
				label := "x_axis"
				if t.DataRequirements.XAxisLabel != "" {
					label = fmt.Sprintf("x_axis (%s)", t.DataRequirements.XAxisLabel)
				}
				parts = append(parts, label)
			}
			if t.DataRequirements.RequiresYAxis {
				label := "y_axis"
				if t.DataRequirements.MultipleYAxis {
					label = "y_axis (multiple allowed)"
				}
				if t.DataRequirements.YAxisLabel != "" {
					label = fmt.Sprintf("%s (%s)", label, t.DataRequirements.YAxisLabel)
				}
				parts = append(parts, label)
			}
			sb.WriteString(strings.Join(parts, ", "))
			sb.WriteString("\n")
		}
	}
	sb.WriteString("\n")
}
