// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useMemo } from 'react';
import {
  Modal, Search, Tag, Tile, Loading,
  Dropdown
} from '@carbon/react';
import {
  ChartLineSmooth, ChartBar, ChartArea, ChartPie,
  Meter, TableSplit, Code
} from '@carbon/icons-react';
import MdiIcon from '@mdi/react';
import { CONTROL_TYPE_INFO } from './controls/controlTypes';
import apiClient from '../api/client';
import './ComponentPickerModal.scss';

// Chart type icon mapping
const CHART_ICONS = {
  bar: ChartBar,
  line: ChartLineSmooth,
  area: ChartArea,
  pie: ChartPie,
  gauge: Meter,
  number: Meter,
  dataview: TableSplit,
  custom: Code
};

// Chart type tag colors
const CHART_TYPE_COLORS = {
  bar: 'blue',
  line: 'green',
  area: 'teal',
  pie: 'purple',
  scatter: 'magenta',
  gauge: 'cyan',
  number: 'cyan',
  dataview: 'warm-gray',
  custom: 'gray'
};

// Filter categories for the dropdown
const CATEGORIES = [
  { id: 'all', text: 'All Components' },
  { id: 'chart', text: 'Charts' },
  { id: 'control', text: 'Controls' },
  { id: 'display', text: 'Displays' }
];

/**
 * ComponentPickerModal Component
 *
 * Modal for browsing and selecting existing components (charts, controls, displays).
 * Features categorized filtering, search, and per-type icons.
 */
function ComponentPickerModal({ open, onClose, onSelect, category: initialCategory }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(null);
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'all');

  useEffect(() => {
    if (open) {
      fetchItems();
      setSelected(null);
      setSearchTerm('');
      setActiveCategory(initialCategory || 'all');
    }
  }, [open, initialCategory]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getCharts();
      // Filter to final versions only
      const finals = (data.charts || []).filter(c => c.status === 'final');
      setItems(finals);
    } catch (err) {
      console.error('Failed to fetch components:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search
  const filtered = useMemo(() => {
    let result = items;

    // Category filter
    if (activeCategory !== 'all') {
      result = result.filter(item => {
        const type = item.component_type || 'chart';
        return type === activeCategory;
      });
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.name?.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.chart_type?.toLowerCase().includes(term) ||
        item.control_config?.control_type?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [items, activeCategory, searchTerm]);

  // Category counts for dropdown labels
  const categoryCounts = useMemo(() => {
    const counts = { all: items.length, chart: 0, control: 0, display: 0 };
    items.forEach(item => {
      const type = item.component_type || 'chart';
      if (counts[type] !== undefined) counts[type]++;
    });
    return counts;
  }, [items]);

  const handleSelect = () => {
    if (selected) onSelect(selected);
  };

  const renderIcon = (item) => {
    const componentType = item.component_type || 'chart';

    if (componentType === 'control') {
      const controlType = item.control_config?.control_type;
      const typeInfo = CONTROL_TYPE_INFO[controlType];
      if (typeInfo?.icon) {
        return <MdiIcon path={typeInfo.icon} size="24px" color="currentColor" />;
      }
    }

    // Chart icons
    const ChartIcon = CHART_ICONS[item.chart_type?.toLowerCase()] || ChartLineSmooth;
    return <ChartIcon size={24} />;
  };

  const getTypeLabel = (item) => {
    const componentType = item.component_type || 'chart';
    if (componentType === 'control') {
      const controlType = item.control_config?.control_type;
      const typeInfo = CONTROL_TYPE_INFO[controlType];
      return typeInfo?.label || controlType || 'Control';
    }
    if (componentType === 'display') {
      return item.display_config?.display_type || 'Display';
    }
    return item.chart_type || 'Chart';
  };

  const getTypeTagColor = (item) => {
    const componentType = item.component_type || 'chart';
    if (componentType === 'control') return 'purple';
    if (componentType === 'display') return 'teal';
    return CHART_TYPE_COLORS[item.chart_type?.toLowerCase()] || 'gray';
  };

  const getCategoryTagColor = (item) => {
    const componentType = item.component_type || 'chart';
    if (componentType === 'control') return 'purple';
    if (componentType === 'display') return 'teal';
    return 'blue';
  };

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      onRequestSubmit={handleSelect}
      modalHeading="Select Component"
      primaryButtonText="Select"
      primaryButtonDisabled={!selected}
      secondaryButtonText="Cancel"
      size="lg"
      className="component-picker-modal"
    >
      <div className="picker-content">
        <div className="picker-toolbar">
          <Dropdown
            id="picker-category"
            label="Category"
            titleText=""
            items={CATEGORIES.map(c => ({
              ...c,
              text: `${c.text} (${categoryCounts[c.id] || 0})`
            }))}
            selectedItem={CATEGORIES.find(c => c.id === activeCategory)}
            itemToString={(item) => item?.text || ''}
            onChange={({ selectedItem }) => setActiveCategory(selectedItem?.id || 'all')}
            size="md"
          />
          <Search
            labelText="Search"
            placeholder="Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="md"
          />
        </div>

        {loading ? (
          <div className="picker-loading">
            <Loading description="Loading..." withOverlay={false} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="picker-empty">
            <p>{items.length === 0 ? 'No components available. Create one first.' : 'No matching components found.'}</p>
          </div>
        ) : (
          <div className="picker-grid">
            {filtered.map(item => (
              <Tile
                key={item.id}
                className={`picker-tile ${selected?.id === item.id ? 'selected' : ''}`}
                onClick={() => setSelected(item)}
              >
                <div className="picker-tile-header">
                  <div className={`picker-tile-icon picker-tile-icon--${getCategoryTagColor(item)}`}>
                    {renderIcon(item)}
                  </div>
                  <Tag size="sm" type={getTypeTagColor(item)}>
                    {getTypeLabel(item)}
                  </Tag>
                </div>
                <div className="picker-tile-content">
                  <h4>{item.name}</h4>
                  {item.description && <p>{item.description}</p>}
                </div>
              </Tile>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default ComponentPickerModal;
