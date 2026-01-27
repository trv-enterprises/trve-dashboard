// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Loading, Modal } from '@carbon/react';
import { Save, Close, ArrowLeft } from '@carbon/icons-react';
import ChartEditor from '../components/ChartEditor';
import apiClient from '../api/client';
import './ChartDetailPage.scss';

/**
 * ChartDetailPage Component
 *
 * Standalone page for creating/editing charts.
 * Uses shared ChartEditor component.
 */
function ChartDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreateMode = id === 'new';

  const [chart, setChart] = useState(null);
  const [loading, setLoading] = useState(!isCreateMode);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [isValid, setIsValid] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    if (!isCreateMode) {
      fetchChart();
    }
  }, [id]);

  const fetchChart = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getChart(id);
      setChart(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (chartPayload) => {
    // Show confirmation modal with the payload
    setPendingPayload(chartPayload);
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    if (!pendingPayload) return;

    setSaving(true);
    try {
      if (isCreateMode) {
        await apiClient.createChart(pendingPayload);
      } else {
        await apiClient.updateChart(id, pendingPayload);
      }

      setShowSaveModal(false);
      navigate('/design/charts');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/design/charts');
  };

  const handleSaveClick = () => {
    if (editorRef.current) {
      editorRef.current.save();
    }
  };

  if (loading) {
    return (
      <div className="chart-detail-page">
        <Loading description="Loading chart..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-detail-page">
        <div className="error-message">Error: {error}</div>
        <Button onClick={() => navigate('/design/charts')}>Back to Charts</Button>
      </div>
    );
  }

  return (
    <div className="chart-detail-page">
      {/* Page header bar with title and actions */}
      <div className="page-header-bar">
        <div className="header-left">
          <Button
            kind="ghost"
            renderIcon={ArrowLeft}
            onClick={() => navigate('/design/charts')}
            size="md"
          >
            Back
          </Button>
          <h1>{isCreateMode ? 'Create Chart' : 'Edit Chart'}</h1>
        </div>
        <div className="page-actions">
          <Button
            kind="secondary"
            renderIcon={Close}
            onClick={handleCancel}
            size="md"
          >
            Cancel
          </Button>
          <Button
            kind="primary"
            renderIcon={Save}
            onClick={handleSaveClick}
            disabled={saving || !isValid}
            size="md"
          >
            Save Chart
          </Button>
        </div>
      </div>

      <ChartEditor
        ref={editorRef}
        chart={chart}
        onSave={handleSave}
        onCancel={handleCancel}
        saving={saving}
        showActions={false}
        className="chart-detail-editor"
        onValidityChange={setIsValid}
      />

      {/* Save confirmation modal */}
      {showSaveModal && (
        <Modal
          open={true}
          onRequestClose={() => setShowSaveModal(false)}
          onRequestSubmit={confirmSave}
          modalHeading={isCreateMode ? "Create Chart" : "Save Changes"}
          primaryButtonText={saving ? "Saving..." : "Save"}
          secondaryButtonText="Cancel"
          primaryButtonDisabled={saving}
        >
          <p>
            {isCreateMode
              ? `Create chart "${pendingPayload?.name}"?`
              : `Save changes to chart "${pendingPayload?.name}"?`}
          </p>
        </Modal>
      )}
    </div>
  );
}

export default ChartDetailPage;
