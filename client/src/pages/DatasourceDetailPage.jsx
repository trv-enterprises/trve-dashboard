import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Loading,
  Modal,
  TextInput,
  Select,
  SelectItem,
  Checkbox,
  NumberInput,
  TextArea,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  InlineNotification
} from '@carbon/react';
import { Save, Close, TrashCan, Play } from '@carbon/icons-react';
import { API_BASE } from '../api/client';
import './DatasourceDetailPage.scss';

/**
 * DatasourceDetailPage Component
 *
 * Create/Edit datasource with type-specific configuration forms.
 * Supports 4 datasource types: SQL, CSV, Socket, API
 */
function DatasourceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreateMode = id === 'new';

  const [datasource, setDatasource] = useState(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('sql');
  const [config, setConfig] = useState({});
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(!isCreateMode);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testInput, setTestInput] = useState('{\n  "type": "reading",\n  "data": {\n    "temperature": 23.5,\n    "humidity": 65,\n    "pressure": 1013.25\n  },\n  "timestamp": "2024-01-15T10:30:00Z"\n}');

  useEffect(() => {
    if (!isCreateMode) {
      fetchDatasource();
    } else {
      // Initialize empty config for create mode
      setConfig(getDefaultConfig('sql'));
    }
  }, [id]);

  const fetchDatasource = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/datasources/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Datasource response:', data);

      setDatasource(data);
      setName(data.name);
      setDescription(data.description || '');
      setType(data.type);
      setConfig(data.config || {});
      setTags(data.tags || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Check for duplicate datasource name on blur
  const checkDuplicateDatasourceName = async (nameToCheck) => {
    if (!nameToCheck || !nameToCheck.trim()) {
      setNameError('');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/datasources`);
      if (!response.ok) throw new Error('Failed to fetch data sources');
      const datasources = await response.json();
      const duplicate = datasources.find(ds =>
        ds.name.toLowerCase() === nameToCheck.trim().toLowerCase() &&
        ds.id !== id
      );
      if (duplicate) {
        setNameError('A data source with this name already exists');
      } else {
        setNameError('');
      }
    } catch (err) {
      console.error('Error checking data source name:', err);
      setNameError('');
    }
  };

  const getDefaultConfig = (datasourceType) => {
    switch (datasourceType) {
      case 'sql':
        return {
          sql: {
            driver: 'postgres',
            connection_string: '',
            host: '',
            port: 5432,
            database: '',
            username: '',
            password: '',
            ssl: false,
            max_connections: 10,
            timeout: 30
          }
        };
      case 'csv':
        return {
          csv: {
            path: '',
            delimiter: ',',
            has_header: true,
            watch_changes: false,
            encoding: 'utf-8'
          }
        };
      case 'socket':
        return {
          socket: {
            url: '',
            protocol: 'websocket',
            reconnect_on_error: true,
            reconnect_delay: 5000,
            ping_interval: 30,
            message_format: 'json',
            buffer_size: 100,
            parser: {
              data_path: '',
              timestamp_field: ''
            }
          }
        };
      case 'api':
        return {
          api: {
            url: '',
            method: 'GET',
            headers: {},
            query_params: {},
            body: '',
            auth_type: 'none',
            auth_credentials: {},
            timeout: 30,
            retry_count: 3,
            retry_delay: 1000
          }
        };
      default:
        return {};
    }
  };

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setType(newType);
    setConfig(getDefaultConfig(newType));
    setHasChanges(true);
  };

  const updateConfig = (path, value) => {
    setConfig((prev) => {
      const newConfig = { ...prev };
      const keys = path.split('.');
      let current = newConfig;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        type,
        config,
        tags
      };

      let response;
      if (isCreateMode) {
        response = await fetch(`${API_BASE}/api/datasources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_BASE}/api/datasources/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();

      if (response.ok) {
        setHasChanges(false);
        setShowSaveModal(false);
        navigate('/design/datasources');
      } else {
        alert(`Failed to save: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowCancelModal(true);
    } else {
      navigate('/design/datasources');
    }
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    navigate('/design/datasources');
  };

  // Helper function to extract data by path (mirrors backend logic)
  const extractByPath = (data, path) => {
    if (!path || path.trim() === '') return data;
    const parts = path.split('.');
    let current = data;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    return current;
  };

  // Compute parsed output based on test input, data_path, and timestamp_field
  const parsedOutput = useMemo(() => {
    const socketConfig = config.socket || {};
    const parserConfig = socketConfig.parser || {};
    const dataPath = parserConfig.data_path || '';
    const timestampField = parserConfig.timestamp_field || '';

    try {
      const parsed = JSON.parse(testInput);

      // Step 1: Extract timestamp from original (before data extraction)
      let extractedTimestamp = null;
      if (timestampField) {
        extractedTimestamp = extractByPath(parsed, timestampField);
      }

      // Step 2: Extract data from data_path
      let extracted = dataPath ? extractByPath(parsed, dataPath) : parsed;

      // Step 3: If extracted is an object, merge timestamp into it
      if (extracted && typeof extracted === 'object' && !Array.isArray(extracted)) {
        extracted = { ...extracted };
        if (extractedTimestamp !== null) {
          extracted.timestamp = extractedTimestamp;
        }
      }

      return {
        success: true,
        original: parsed,
        extracted: extracted,
        fields: extracted && typeof extracted === 'object' && !Array.isArray(extracted)
          ? Object.keys(extracted)
          : []
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        original: null,
        extracted: null,
        fields: []
      };
    }
  }, [testInput, config.socket?.parser?.data_path, config.socket?.parser?.timestamp_field]);

  const renderSQLConfig = () => {
    const sqlConfig = config.sql || {};
    return (
      <div className="config-form">
        <Select
          id="sql-driver"
          labelText="Database Driver"
          value={sqlConfig.driver || 'postgres'}
          onChange={(e) => updateConfig('sql.driver', e.target.value)}
        >
          <SelectItem value="postgres" text="PostgreSQL" />
          <SelectItem value="mysql" text="MySQL" />
          <SelectItem value="sqlite" text="SQLite" />
          <SelectItem value="mssql" text="MS SQL Server" />
          <SelectItem value="oracle" text="Oracle" />
        </Select>

        <TextInput
          id="sql-connection-string"
          labelText="Connection String"
          value={sqlConfig.connection_string || ''}
          onChange={(e) => updateConfig('sql.connection_string', e.target.value)}
          placeholder="postgres://user:pass@host:port/db"
        />

        <div className="form-row">
          <TextInput
            id="sql-host"
            labelText="Host"
            value={sqlConfig.host || ''}
            onChange={(e) => updateConfig('sql.host', e.target.value)}
            placeholder="localhost"
          />
          <NumberInput
            id="sql-port"
            label="Port"
            value={sqlConfig.port || 5432}
            onChange={(e) => updateConfig('sql.port', e.imaginaryTarget.value)}
            min={1}
            max={65535}
          />
        </div>

        <div className="form-row">
          <TextInput
            id="sql-database"
            labelText="Database"
            value={sqlConfig.database || ''}
            onChange={(e) => updateConfig('sql.database', e.target.value)}
          />
          <TextInput
            id="sql-username"
            labelText="Username"
            value={sqlConfig.username || ''}
            onChange={(e) => updateConfig('sql.username', e.target.value)}
          />
        </div>

        <TextInput
          id="sql-password"
          labelText="Password"
          type="password"
          value={sqlConfig.password || ''}
          onChange={(e) => updateConfig('sql.password', e.target.value)}
        />

        <Checkbox
          id="sql-ssl"
          labelText="Use SSL"
          checked={sqlConfig.ssl || false}
          onChange={(e) => updateConfig('sql.ssl', e.target.checked)}
        />

        <div className="form-row">
          <NumberInput
            id="sql-max-connections"
            label="Max Connections"
            value={sqlConfig.max_connections || 10}
            onChange={(e) => updateConfig('sql.max_connections', e.imaginaryTarget.value)}
            min={1}
            max={100}
          />
          <NumberInput
            id="sql-timeout"
            label="Timeout (seconds)"
            value={sqlConfig.timeout || 30}
            onChange={(e) => updateConfig('sql.timeout', e.imaginaryTarget.value)}
            min={1}
            max={300}
          />
        </div>
      </div>
    );
  };

  const renderCSVConfig = () => {
    const csvConfig = config.csv || {};
    return (
      <div className="config-form">
        <TextInput
          id="csv-path"
          labelText="File Path"
          value={csvConfig.path || ''}
          onChange={(e) => updateConfig('csv.path', e.target.value)}
          placeholder="/path/to/file.csv"
        />

        <TextInput
          id="csv-delimiter"
          labelText="Delimiter"
          value={csvConfig.delimiter || ','}
          onChange={(e) => updateConfig('csv.delimiter', e.target.value)}
          maxLength={1}
        />

        <TextInput
          id="csv-encoding"
          labelText="Encoding"
          value={csvConfig.encoding || 'utf-8'}
          onChange={(e) => updateConfig('csv.encoding', e.target.value)}
        />

        <Checkbox
          id="csv-has-header"
          labelText="File has header row"
          checked={csvConfig.has_header !== false}
          onChange={(e) => updateConfig('csv.has_header', e.target.checked)}
        />

        <Checkbox
          id="csv-watch-changes"
          labelText="Watch for file changes"
          checked={csvConfig.watch_changes || false}
          onChange={(e) => updateConfig('csv.watch_changes', e.target.checked)}
        />
      </div>
    );
  };

  const renderSocketConfig = () => {
    const socketConfig = config.socket || {};
    const parserConfig = socketConfig.parser || {};
    return (
      <div className="config-form">
        <TextInput
          id="socket-url"
          labelText="URL"
          value={socketConfig.url || ''}
          onChange={(e) => updateConfig('socket.url', e.target.value)}
          placeholder="ws://localhost:8080/stream"
        />

        <div className="form-row">
          <Select
            id="socket-protocol"
            labelText="Protocol"
            value={socketConfig.protocol || 'websocket'}
            onChange={(e) => updateConfig('socket.protocol', e.target.value)}
          >
            <SelectItem value="websocket" text="WebSocket" />
            <SelectItem value="tcp" text="TCP" />
            <SelectItem value="udp" text="UDP" />
          </Select>

          <Select
            id="socket-message-format"
            labelText="Message Format"
            value={socketConfig.message_format || 'json'}
            onChange={(e) => updateConfig('socket.message_format', e.target.value)}
          >
            <SelectItem value="json" text="JSON" />
            <SelectItem value="text" text="Text" />
            <SelectItem value="binary" text="Binary" />
          </Select>
        </div>

        <Checkbox
          id="socket-reconnect"
          labelText="Reconnect on error"
          checked={socketConfig.reconnect_on_error !== false}
          onChange={(e) => updateConfig('socket.reconnect_on_error', e.target.checked)}
        />

        <div className="form-row">
          <NumberInput
            id="socket-reconnect-delay"
            label="Reconnect Delay (ms)"
            value={socketConfig.reconnect_delay || 5000}
            onChange={(e) => updateConfig('socket.reconnect_delay', e.imaginaryTarget.value)}
            min={100}
            max={60000}
          />
          <NumberInput
            id="socket-ping-interval"
            label="Ping Interval (seconds)"
            value={socketConfig.ping_interval || 30}
            onChange={(e) => updateConfig('socket.ping_interval', e.imaginaryTarget.value)}
            min={1}
            max={300}
          />
        </div>

        <NumberInput
          id="socket-buffer-size"
          label="Buffer Size (messages)"
          value={socketConfig.buffer_size || 100}
          onChange={(e) => updateConfig('socket.buffer_size', e.imaginaryTarget.value)}
          min={1}
          max={10000}
        />

        {/* Parser Configuration Section */}
        <div className="parser-config-section">
          <h4>Data Parser Configuration</h4>
          <p className="helper-text">
            Configure how to extract data fields from incoming messages.
          </p>

          <div className="parser-fields-row">
            <TextInput
              id="socket-data-path"
              labelText="Data Path"
              value={parserConfig.data_path || ''}
              onChange={(e) => updateConfig('socket.parser.data_path', e.target.value)}
              placeholder="data, payload.readings"
              helperText="Path to the data object containing metrics"
            />
            <TextInput
              id="socket-timestamp-field"
              labelText="Timestamp Field"
              value={parserConfig.timestamp_field || ''}
              onChange={(e) => updateConfig('socket.parser.timestamp_field', e.target.value)}
              placeholder="timestamp, ts, time"
              helperText="Path to the timestamp (extracted before data path)"
            />
          </div>

          {/* Test Parse Preview */}
          <div className="parse-preview-section">
            <h5>Test Parser</h5>
            <p className="helper-text">
              Paste a sample message to test the data path extraction.
            </p>

            <div className="preview-columns">
              <div className="preview-column">
                <label className="preview-label">Sample Input (JSON)</label>
                <TextArea
                  id="test-input"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={8}
                  className="preview-textarea"
                />
              </div>
              <div className="preview-column">
                <label className="preview-label">
                  Extracted Output {parserConfig.data_path && <span className="path-badge">path: {parserConfig.data_path}</span>}
                </label>
                {parsedOutput.success ? (
                  <pre className="preview-output">
                    {JSON.stringify(parsedOutput.extracted, null, 2)}
                  </pre>
                ) : (
                  <InlineNotification
                    kind="error"
                    title="Parse Error"
                    subtitle={parsedOutput.error}
                    lowContrast
                    hideCloseButton
                  />
                )}
                {parsedOutput.success && parsedOutput.fields.length > 0 && (
                  <div className="extracted-fields">
                    <span className="fields-label">Fields: </span>
                    {parsedOutput.fields.map((field, i) => (
                      <span key={field} className="field-tag">{field}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAPIConfig = () => {
    const apiConfig = config.api || {};
    return (
      <div className="config-form">
        <TextInput
          id="api-url"
          labelText="URL"
          value={apiConfig.url || ''}
          onChange={(e) => updateConfig('api.url', e.target.value)}
          placeholder="https://api.example.com/data"
        />

        <Select
          id="api-method"
          labelText="HTTP Method"
          value={apiConfig.method || 'GET'}
          onChange={(e) => updateConfig('api.method', e.target.value)}
        >
          <SelectItem value="GET" text="GET" />
          <SelectItem value="POST" text="POST" />
          <SelectItem value="PUT" text="PUT" />
          <SelectItem value="DELETE" text="DELETE" />
          <SelectItem value="PATCH" text="PATCH" />
        </Select>

        <Select
          id="api-auth-type"
          labelText="Authentication"
          value={apiConfig.auth_type || 'none'}
          onChange={(e) => updateConfig('api.auth_type', e.target.value)}
        >
          <SelectItem value="none" text="None" />
          <SelectItem value="bearer" text="Bearer Token" />
          <SelectItem value="basic" text="Basic Auth" />
          <SelectItem value="api-key" text="API Key" />
        </Select>

        <TextArea
          id="api-body"
          labelText="Request Body (JSON)"
          value={apiConfig.body || ''}
          onChange={(e) => updateConfig('api.body', e.target.value)}
          placeholder='{"key": "value"}'
          rows={4}
        />

        <div className="form-row">
          <NumberInput
            id="api-timeout"
            label="Timeout (seconds)"
            value={apiConfig.timeout || 30}
            onChange={(e) => updateConfig('api.timeout', e.imaginaryTarget.value)}
            min={1}
            max={300}
          />
          <NumberInput
            id="api-retry-count"
            label="Retry Count"
            value={apiConfig.retry_count || 3}
            onChange={(e) => updateConfig('api.retry_count', e.imaginaryTarget.value)}
            min={0}
            max={10}
          />
        </div>

        <NumberInput
          id="api-retry-delay"
          label="Retry Delay (ms)"
          value={apiConfig.retry_delay || 1000}
          onChange={(e) => updateConfig('api.retry_delay', e.imaginaryTarget.value)}
          min={100}
          max={10000}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="datasource-detail-page">
        <Loading description="Loading datasource..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="datasource-detail-page">
        <div className="error-message">Error: {error}</div>
        <Button onClick={() => navigate('/design/datasources')}>Back to Datasources</Button>
      </div>
    );
  }

  return (
    <div className="datasource-detail-page">
      {/* Page header bar with title and actions */}
      <div className="page-header-bar">
        <h1>{isCreateMode ? 'Create Data Source' : 'Edit Data Source'}</h1>
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
            onClick={() => setShowSaveModal(true)}
            disabled={!name || !type}
            size="md"
          >
            Save Data Source
          </Button>
        </div>
      </div>

      {/* Form content */}
      <div className="form-content">
        {/* Datasource Name - full width */}
        <div className="form-row">
          <TextInput
            id="datasource-name"
            labelText="Data Source Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasChanges(true);
              if (nameError) setNameError('');
            }}
            onBlur={(e) => checkDuplicateDatasourceName(e.target.value)}
            placeholder="Enter data source name"
            invalid={!!nameError}
            invalidText={nameError}
          />
        </div>

        {/* Description - full width */}
        <div className="form-row">
          <TextInput
            id="datasource-description"
            labelText="Description (optional)"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Enter data source description"
          />
        </div>

        {/* Type selector */}
        <div className="form-row">
          <Select
            id="datasource-type"
            labelText="Data Source Type"
            value={type}
            onChange={handleTypeChange}
            disabled={!isCreateMode}
          >
            <SelectItem value="sql" text="SQL Database" />
            <SelectItem value="csv" text="CSV File" />
            <SelectItem value="socket" text="Socket/WebSocket" />
            <SelectItem value="api" text="REST API" />
          </Select>
        </div>

        {/* Type-specific configuration */}
        <div className="config-section">
          <h3>Configuration</h3>
          {type === 'sql' && renderSQLConfig()}
          {type === 'csv' && renderCSVConfig()}
          {type === 'socket' && renderSocketConfig()}
          {type === 'api' && renderAPIConfig()}
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <Modal
          open={true}
          onRequestClose={() => setShowCancelModal(false)}
          onRequestSubmit={confirmCancel}
          modalHeading="Discard Changes?"
          primaryButtonText="Discard"
          secondaryButtonText="Keep Editing"
          danger
        >
          <p>You have unsaved changes. Are you sure you want to discard them?</p>
        </Modal>
      )}

      {/* Save confirmation modal */}
      {showSaveModal && (
        <Modal
          open={true}
          onRequestClose={() => setShowSaveModal(false)}
          onRequestSubmit={handleSave}
          modalHeading={isCreateMode ? "Create Datasource" : "Save Changes"}
          primaryButtonText={saving ? "Saving..." : "Save"}
          secondaryButtonText="Cancel"
          primaryButtonDisabled={saving}
        >
          <p>
            {isCreateMode
              ? `Create datasource "${name}" of type ${type}?`
              : `Save changes to datasource "${name}"?`}
          </p>
        </Modal>
      )}
    </div>
  );
}

export default DatasourceDetailPage;
