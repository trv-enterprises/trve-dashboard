// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import { Modal, Search, Tag, Tile, Loading } from '@carbon/react';
import { ChartLineSmooth, Keyboard } from '@carbon/icons-react';
import apiClient from '../api/client';
import './ComponentPickerModal.scss';

/**
 * ComponentPickerModal Component
 *
 * Modal for browsing and selecting existing charts or controls.
 * Displays a searchable grid of items with type tags.
 *
 * @param {boolean} open - Whether the modal is open
 * @param {Function} onClose - Handler for closing the modal
 * @param {Function} onSelect - Handler for selecting an item (receives the selected item)
 * @param {string} category - Category to display: 'chart' or 'control'
 */
function ComponentPickerModal({ open, onClose, onSelect, category }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (open) {
      fetchItems();
      setSelected(null);
      setSearchTerm('');
    }
  }, [open, category]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      if (category === 'chart') {
        const data = await apiClient.getCharts();
        setItems(data.charts || []);
      } else {
        // Future: apiClient.getControls()
        setItems([]);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = items.filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.chart_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  const getChartTypeColor = (chartType) => {
    const colors = {
      'bar': 'blue',
      'line': 'green',
      'area': 'teal',
      'pie': 'purple',
      'scatter': 'magenta',
      'gauge': 'cyan',
      'custom': 'gray'
    };
    return colors[chartType?.toLowerCase()] || 'gray';
  };

  const modalHeading = category === 'chart' ? 'Select Display' : 'Select Control';
  const searchPlaceholder = category === 'chart' ? 'Search displays...' : 'Search controls...';
  const emptyMessage = category === 'chart'
    ? 'No displays available. Create one first.'
    : 'No controls available. Create one first.';

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      onRequestSubmit={handleSelect}
      modalHeading={modalHeading}
      primaryButtonText="Select"
      primaryButtonDisabled={!selected}
      secondaryButtonText="Cancel"
      size="lg"
      className="component-picker-modal"
    >
      <div className="picker-content">
        <Search
          labelText="Search"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="lg"
        />

        {loading ? (
          <div className="picker-loading">
            <Loading description="Loading..." withOverlay={false} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="picker-empty">
            {category === 'chart' ? <ChartLineSmooth size={48} /> : <Keyboard size={48} />}
            <p>{items.length === 0 ? emptyMessage : 'No matching items found.'}</p>
          </div>
        ) : (
          <div className="picker-grid">
            {filtered.map(item => (
              <Tile
                key={item.id}
                className={`picker-tile ${selected?.id === item.id ? 'selected' : ''}`}
                onClick={() => setSelected(item)}
              >
                <div className="picker-tile-icon">
                  {category === 'chart' ? <ChartLineSmooth size={24} /> : <Keyboard size={24} />}
                </div>
                <div className="picker-tile-content">
                  <h4>{item.name}</h4>
                  {item.description && <p>{item.description}</p>}
                  <div className="picker-tile-tags">
                    <Tag size="sm" type={getChartTypeColor(item.chart_type || item.control_type)}>
                      {(item.chart_type || item.control_type || 'N/A').toUpperCase()}
                    </Tag>
                    {item.status && (
                      <Tag size="sm" type={item.status === 'final' ? 'green' : 'gray'}>
                        {item.status === 'final' ? `V${item.version || 0}` : 'DRAFT'}
                      </Tag>
                    )}
                  </div>
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
