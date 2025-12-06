import { useState, useEffect, useCallback } from 'react';
import { Modal, RadioButton, RadioButtonGroup, Loading } from '@carbon/react';
import apiClient from '../api/client';
import './ChartDeleteDialog.scss';

/**
 * ChartDeleteDialog Component
 *
 * Version-aware delete dialog for charts with three variants:
 * 1. Draft: Simple discard confirmation
 * 2. Final with previous versions: Choice dialog (delete this version or all)
 * 3. Final single version: Simple permanent delete confirmation
 */
function ChartDeleteDialog({ open, chart, onClose, onDelete }) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [versionInfo, setVersionInfo] = useState(null);
  const [deleteOption, setDeleteOption] = useState('version'); // 'version' or 'all'
  const [error, setError] = useState(null);

  const fetchVersionInfo = useCallback(async () => {
    if (!chart?.id) return;
    setLoading(true);
    setError(null);
    try {
      const info = await apiClient.getChartVersionInfo(chart.id);
      setVersionInfo(info);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [chart?.id]);

  // Fetch version info when dialog opens
  useEffect(() => {
    if (open && chart?.id) {
      fetchVersionInfo();
    } else {
      // Reset state when closed
      setVersionInfo(null);
      setDeleteOption('version');
      setError(null);
    }
  }, [open, chart?.id, fetchVersionInfo]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const isDraft = versionInfo?.status === 'draft';
      const hasMultipleVersions = versionInfo?.version_count > 1;

      if (isDraft) {
        // Delete draft
        await apiClient.deleteChartDraft(chart.id);
      } else if (deleteOption === 'all' || !hasMultipleVersions) {
        // Delete all versions (or the only version)
        await apiClient.deleteChart(chart.id);
      } else {
        // Delete specific version
        await apiClient.deleteChartVersion(chart.id, versionInfo.version);
      }

      onDelete();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Determine dialog type
  const isDraft = versionInfo?.status === 'draft';
  const hasMultipleVersions = versionInfo?.version_count > 1;
  const hasPreviousVersion = versionInfo?.previous_version > 0;

  // Dialog content based on type
  const getDialogContent = () => {
    if (loading) {
      return (
        <div className="delete-dialog-loading">
          <Loading description="Loading version info..." withOverlay={false} small />
        </div>
      );
    }

    if (error && !versionInfo) {
      return (
        <div className="delete-dialog-error">
          <p>Error loading chart info: {error}</p>
        </div>
      );
    }

    if (isDraft && hasPreviousVersion) {
      // Draft with previous version - discard dialog
      return (
        <div className="delete-dialog-content">
          <p>
            This will discard your draft changes to <strong>"{chart?.name}"</strong> and
            revert to the previous saved version (v{versionInfo.previous_version}).
          </p>
        </div>
      );
    }

    if (isDraft && !hasPreviousVersion) {
      // Draft without previous version (new chart) - delete dialog
      return (
        <div className="delete-dialog-content">
          <p>
            This will permanently delete <strong>"{chart?.name}"</strong>.
            This action cannot be undone.
          </p>
        </div>
      );
    }

    if (!isDraft && hasMultipleVersions) {
      // Final with multiple versions - choice dialog
      return (
        <div className="delete-dialog-content">
          <RadioButtonGroup
            legendText=""
            name="delete-option"
            valueSelected={deleteOption}
            onChange={setDeleteOption}
            orientation="vertical"
          >
            <RadioButton
              id="delete-version"
              labelText={
                <span className="radio-label">
                  <strong>Delete this version only (v{versionInfo.version})</strong>
                  <span className="radio-description">
                    Reverts to previous version (v{versionInfo.previous_version})
                  </span>
                </span>
              }
              value="version"
            />
            <RadioButton
              id="delete-all"
              labelText={
                <span className="radio-label">
                  <strong>Delete all versions</strong>
                  <span className="radio-description">
                    Permanently removes this chart ({versionInfo.version_count} versions)
                  </span>
                </span>
              }
              value="all"
            />
          </RadioButtonGroup>
        </div>
      );
    }

    // Final single version - simple delete
    return (
      <div className="delete-dialog-content">
        <p>
          This will permanently delete <strong>"{chart?.name}"</strong>.
          This action cannot be undone.
        </p>
      </div>
    );
  };

  const getHeading = () => {
    if (isDraft && hasPreviousVersion) {
      return 'Discard draft?';
    }
    return `Delete "${chart?.name || 'Chart'}"`;
  };

  const getPrimaryButtonText = () => {
    if (deleting) return 'Deleting...';
    if (isDraft && hasPreviousVersion) return 'Discard';
    return 'Delete';
  };

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      onRequestSubmit={handleDelete}
      modalHeading={getHeading()}
      primaryButtonText={getPrimaryButtonText()}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={loading || deleting}
      danger={!isDraft || !hasPreviousVersion}
      size="sm"
      className="chart-delete-dialog"
    >
      {getDialogContent()}
      {error && versionInfo && (
        <div className="delete-dialog-error">
          <p>Error: {error}</p>
        </div>
      )}
    </Modal>
  );
}

export default ChartDeleteDialog;
