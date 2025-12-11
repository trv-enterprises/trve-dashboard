import { useState, useEffect, useRef } from 'react';
import { Modal } from '@carbon/react';
import ChartEditor from './ChartEditor';
import apiClient from '../api/client';
import './ChartEditorModal.scss';

/**
 * ChartEditorModal Component
 *
 * Modal wrapper for ChartEditor component.
 * Used in dashboard editing to create/edit charts inline.
 */
function ChartEditorModal({ open, onClose, onSave, chart, panelId }) {
  const [saving, setSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const editorRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSaving(false);
      setShowCancelConfirm(false);
      // Set initial validity based on whether we're editing an existing chart
      setIsValid(!!chart?.name);
    }
  }, [open, chart]);

  const handleSave = async (chartPayload) => {
    setSaving(true);
    try {
      // Capture thumbnail now that "Saving..." is visible
      let thumbnail = null;
      if (editorRef.current?.captureThumbnail) {
        thumbnail = await editorRef.current.captureThumbnail();
      }

      // Add thumbnail to payload
      const payloadWithThumbnail = { ...chartPayload, thumbnail };

      let savedChart;
      if (chart?.id) {
        // Update existing chart
        savedChart = await apiClient.updateChart(chart.id, payloadWithThumbnail);
      } else {
        // Create new chart
        savedChart = await apiClient.createChart(payloadWithThumbnail);
      }

      // Return the saved chart with panel_id for dashboard to link
      await onSave({
        ...savedChart,
        panel_id: panelId,
      });
      onClose();
    } catch (err) {
      alert(`Error saving chart: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSubmit = () => {
    if (editorRef.current) {
      editorRef.current.save();
    }
  };

  return (
    <>
      <Modal
        open={open}
        onRequestClose={handleClose}
        onRequestSubmit={handleSubmit}
        modalHeading={chart ? `Edit Chart: ${chart.name || 'Untitled'}` : 'Create New Chart'}
        modalLabel="Chart Editor"
        primaryButtonText={saving ? 'Saving...' : 'Save'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={saving || !isValid}
        size="lg"
        className="chart-editor-modal"
        preventCloseOnClickOutside
        isFullWidth
      >
        <div className="chart-editor-content">
          <ChartEditor
            ref={editorRef}
            chart={chart}
            onSave={handleSave}
            onCancel={handleClose}
            saving={saving}
            showActions={false}
            onValidityChange={setIsValid}
          />
        </div>
      </Modal>

      {/* Cancel confirmation modal */}
      <Modal
        open={showCancelConfirm}
        onRequestClose={() => setShowCancelConfirm(false)}
        onRequestSubmit={() => {
          setShowCancelConfirm(false);
          onClose();
        }}
        modalHeading="Discard Changes?"
        modalLabel="Unsaved Changes"
        primaryButtonText="Discard"
        secondaryButtonText="Keep Editing"
        danger
        size="xs"
      >
        <p style={{ color: 'var(--cds-text-secondary)' }}>
          You have unsaved changes to this chart. Are you sure you want to discard them?
        </p>
      </Modal>
    </>
  );
}

export default ChartEditorModal;
