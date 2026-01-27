// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import ComponentSelector from '../components/ComponentSelector';
import ComponentViewer from '../components/ComponentViewer';
import ComponentEditor from '../components/ComponentEditor';
import { useComponentActions } from '../hooks/useComponents';
import './ChartDesignPage.scss';

function ChartDesignPage() {
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [mode, setMode] = useState('view'); // 'view' | 'create' | 'edit'
  const [editingComponent, setEditingComponent] = useState(null);
  const { deleteComponent } = useComponentActions();

  // Listen for create component event from header button
  useEffect(() => {
    const handleCreateEvent = () => {
      setEditingComponent(null);
      setMode('create');
    };

    window.addEventListener('create-component', handleCreateEvent);
    return () => window.removeEventListener('create-component', handleCreateEvent);
  }, []);

  const handleComponentSelect = (component) => {
    setSelectedComponent(component);
    setMode('view');
  };

  const handleEdit = (component) => {
    setEditingComponent(component);
    setMode('edit');
  };

  const handleDelete = async (component) => {
    try {
      await deleteComponent(component.system, component.source, component.name);
      setSelectedComponent(null);
      setMode('view');
      // Trigger re-fetch by reloading
      window.location.reload();
    } catch (err) {
      console.error('Error deleting component:', err);
    }
  };

  const handleSave = () => {
    setMode('view');
    setEditingComponent(null);
    // Trigger re-fetch
    window.location.reload();
  };

  const handleCancel = () => {
    setMode('view');
    setEditingComponent(null);
  };

  return (
    <div className="chart-design-page">
      <div className="chart-design-sidebar">
        <ComponentSelector
          onSelect={handleComponentSelect}
          selectedId={selectedComponent?.id}
        />
      </div>

      <div className="chart-design-content">
        {mode === 'view' && (
          <ComponentViewer
            componentId={selectedComponent?.id}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {(mode === 'create' || mode === 'edit') && (
          <ComponentEditor
            component={editingComponent}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
}

export default ChartDesignPage;
