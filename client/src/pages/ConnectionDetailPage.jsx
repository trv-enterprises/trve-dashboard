// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

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
  InlineNotification,
  Tag,
  Toggle
} from '@carbon/react';
import { Save, Close, TrashCan, Play, ConnectionSignal, Checkmark, ErrorFilled, ArrowLeft } from '@carbon/icons-react';
import apiClient, { API_BASE } from '../api/client';
import './ConnectionDetailPage.scss';

/**
 * ConnectionDetailPage Component
 *
 * Create/Edit connection with type-specific configuration forms.
 * Supports connection types: SQL, CSV, Socket, API, TSStore, Prometheus, EdgeLake
 */
// Constant for masked secret value - must match backend SecretMaskedValue
const SECRET_MASKED_VALUE = '********';

function ConnectionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreateMode = id === 'new';

  const [connection, setConnection] = useState(null);
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

  // Test connection state
  const [testing, setTesting] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testSchema, setTestSchema] = useState(null);

  useEffect(() => {
    if (!isCreateMode) {
      fetchConnection();
    } else {
      // Initialize empty config for create mode
      setConfig(getDefaultConfig('sql'));
    }
  }, [id]);

  const fetchConnection = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getConnection(id);
      console.log('Connection response:', data);

      setConnection(data);
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

  // Check for duplicate connection name on blur
  const checkDuplicateConnectionName = async (nameToCheck) => {
    if (!nameToCheck || !nameToCheck.trim()) {
      setNameError('');
      return;
    }
    try {
      const response = await apiClient.getConnections();
      const connections = response.datasources || response.connections || [];
      const duplicate = connections.find(conn =>
        conn.name.toLowerCase() === nameToCheck.trim().toLowerCase() &&
        conn.id !== id
      );
      if (duplicate) {
        setNameError('A connection with this name already exists');
      } else {
        setNameError('');
      }
    } catch (err) {
      console.error('Error checking connection name:', err);
      setNameError('');
    }
  };

  const getDefaultConfig = (connectionType) => {
    switch (connectionType) {
      case 'sql':
        return {
          sql: {
            driver: 'postgres',
            host: '',
            port: 5432,
            database: '',
            username: '',
            password: '',
            ssl: false,
            max_connections: 10,
            timeout: 30,
            options: ''
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
      case 'tsstore':
        return {
          tsstore: {
            protocol: 'http',
            host: '',
            port: 21080,
            store_name: '',
            api_key: '',
            timeout: 30
          }
        };
      case 'prometheus':
        return {
          prometheus: {
            url: '',
            username: '',
            password: '',
            timeout: 30
          }
        };
      case 'edgelake':
        return {
          edgelake: {
            host: '',
            port: 32049,
            timeout: 20,
            use_distributed_query: false
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
      // Deep clone to avoid mutation issues with nested objects
      const newConfig = JSON.parse(JSON.stringify(prev));
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

  // Prepare config for save, preserving masked secrets
  const prepareConfigForSave = (configToSave) => {
    const prepared = JSON.parse(JSON.stringify(configToSave)); // Deep clone

    // For SQL: if password is empty and was masked, keep the masked value
    if (prepared.sql) {
      if (prepared.sql.password === '' && connection?.config?.sql?.password === SECRET_MASKED_VALUE) {
        prepared.sql.password = SECRET_MASKED_VALUE;
      }
    }

    // For TSStore: if api_key is empty and was masked, keep the masked value
    if (prepared.tsstore) {
      if (prepared.tsstore.api_key === '' && connection?.config?.tsstore?.api_key === SECRET_MASKED_VALUE) {
        prepared.tsstore.api_key = SECRET_MASKED_VALUE;
      }
    }

    // For API: preserve masked auth_credentials
    if (prepared.api && prepared.api.auth_credentials) {
      const originalCreds = connection?.config?.api?.auth_credentials || {};
      for (const key in prepared.api.auth_credentials) {
        if (prepared.api.auth_credentials[key] === '' && originalCreds[key] === SECRET_MASKED_VALUE) {
          prepared.api.auth_credentials[key] = SECRET_MASKED_VALUE;
        }
      }
    }

    return prepared;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const preparedConfig = isCreateMode ? config : prepareConfigForSave(config);

      const payload = {
        name,
        description,
        type,
        config: preparedConfig,
        tags
      };

      if (isCreateMode) {
        await apiClient.createConnection(payload);
      } else {
        await apiClient.updateConnection(id, payload);
      }

      setHasChanges(false);
      setShowSaveModal(false);
      navigate('/design/connections');
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowCancelModal(true);
    } else {
      navigate('/design/connections');
    }
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    navigate('/design/connections');
  };

  // Test connection handler
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setTestSchema(null);

    try {
      let result;
      if (isCreateMode) {
        // For new connections, test with the provided config
        result = await apiClient.testConnection(type, config);
      } else {
        // For existing connections, use health check which fetches credentials from DB
        const healthResult = await apiClient.checkConnectionHealth(id);
        // Convert health response to test response format
        result = {
          success: healthResult.status === 'healthy',
          status: healthResult.status,
          message: healthResult.error_message || (healthResult.status === 'healthy' ? 'Connection successful' : 'Connection failed'),
          response_time: healthResult.response_time
        };
      }
      setTestResult(result);

      // For SQL connections, schema is included in the test response data
      if (result.success && type === 'sql' && result.data) {
        setTestSchema(result.data);
      }

      setShowTestModal(true);
    } catch (err) {
      setTestResult({
        success: false,
        status: 'error',
        message: err.message || 'Connection test failed'
      });
      setShowTestModal(true);
    } finally {
      setTesting(false);
    }
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
    const isSQLite = sqlConfig.driver === 'sqlite';
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

        {!isSQLite && (
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
        )}

        <TextInput
          id="sql-database"
          labelText={isSQLite ? "Database Path" : "Database"}
          value={sqlConfig.database || ''}
          onChange={(e) => updateConfig('sql.database', e.target.value)}
          placeholder={isSQLite ? "/path/to/database.db or :memory:" : "database_name"}
        />

        {!isSQLite && (
          <>
            <div className="form-row">
              <TextInput
                id="sql-username"
                labelText="Username"
                value={sqlConfig.username || ''}
                onChange={(e) => updateConfig('sql.username', e.target.value)}
              />
              <TextInput
                id="sql-password"
                labelText="Password"
                type="password"
                value={sqlConfig.password === SECRET_MASKED_VALUE ? '' : (sqlConfig.password || '')}
                onChange={(e) => updateConfig('sql.password', e.target.value)}
                placeholder={sqlConfig.password === SECRET_MASKED_VALUE ? 'Password is set (enter new value to change)' : 'Enter password'}
              />
            </div>

            <Checkbox
              id="sql-ssl"
              labelText="Use SSL"
              checked={sqlConfig.ssl || false}
              onChange={(e) => updateConfig('sql.ssl', e.target.checked)}
            />
          </>
        )}

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

        <TextInput
          id="sql-options"
          labelText="Optional Parameters"
          value={sqlConfig.options || ''}
          onChange={(e) => updateConfig('sql.options', e.target.value)}
          placeholder="e.g., sslmode=verify-full or application_name=dashboard"
          helperText="Additional driver-specific connection parameters"
        />
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
                    {parsedOutput.fields.map((field) => (
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
          onChange={(e) => {
            updateConfig('api.auth_type', e.target.value);
            // Clear auth credentials when changing type
            updateConfig('api.auth_credentials', {});
          }}
        >
          <SelectItem value="none" text="None" />
          <SelectItem value="bearer" text="Bearer Token" />
          <SelectItem value="basic" text="Basic Auth" />
          <SelectItem value="api-key" text="API Key" />
        </Select>

        {/* Bearer Token auth */}
        {apiConfig.auth_type === 'bearer' && (
          <TextInput
            id="api-auth-bearer-token"
            labelText="Bearer Token"
            type="password"
            value={apiConfig.auth_credentials?.token === SECRET_MASKED_VALUE ? '' : (apiConfig.auth_credentials?.token || '')}
            onChange={(e) => updateConfig('api.auth_credentials', { ...apiConfig.auth_credentials, token: e.target.value })}
            placeholder={apiConfig.auth_credentials?.token === SECRET_MASKED_VALUE ? 'Token is set (enter new value to change)' : 'Enter bearer token'}
          />
        )}

        {/* Basic Auth */}
        {apiConfig.auth_type === 'basic' && (
          <div className="form-row">
            <TextInput
              id="api-auth-basic-username"
              labelText="Username"
              value={apiConfig.auth_credentials?.username || ''}
              onChange={(e) => updateConfig('api.auth_credentials', { ...apiConfig.auth_credentials, username: e.target.value })}
              placeholder="Enter username"
            />
            <TextInput
              id="api-auth-basic-password"
              labelText="Password"
              type="password"
              value={apiConfig.auth_credentials?.password === SECRET_MASKED_VALUE ? '' : (apiConfig.auth_credentials?.password || '')}
              onChange={(e) => updateConfig('api.auth_credentials', { ...apiConfig.auth_credentials, password: e.target.value })}
              placeholder={apiConfig.auth_credentials?.password === SECRET_MASKED_VALUE ? 'Password is set (enter new value to change)' : 'Enter password'}
            />
          </div>
        )}

        {/* API Key auth */}
        {apiConfig.auth_type === 'api-key' && (
          <div className="form-row">
            <TextInput
              id="api-auth-apikey-header"
              labelText="Header Name"
              value={apiConfig.auth_credentials?.header || 'X-API-Key'}
              onChange={(e) => updateConfig('api.auth_credentials', { ...apiConfig.auth_credentials, header: e.target.value })}
              placeholder="X-API-Key"
              helperText="HTTP header name for the API key"
            />
            <TextInput
              id="api-auth-apikey-value"
              labelText="API Key"
              type="password"
              value={apiConfig.auth_credentials?.key === SECRET_MASKED_VALUE ? '' : (apiConfig.auth_credentials?.key || '')}
              onChange={(e) => updateConfig('api.auth_credentials', { ...apiConfig.auth_credentials, key: e.target.value })}
              placeholder={apiConfig.auth_credentials?.key === SECRET_MASKED_VALUE ? 'API key is set (enter new value to change)' : 'Enter API key'}
            />
          </div>
        )}

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

  const renderTSStoreConfig = () => {
    const tsstoreConfig = config.tsstore || {};
    return (
      <div className="config-form">
        <div className="form-row">
          <Select
            id="tsstore-protocol"
            labelText="Protocol"
            value={tsstoreConfig.protocol || 'http'}
            onChange={(e) => updateConfig('tsstore.protocol', e.target.value)}
            helperText="HTTP/WS for unencrypted, HTTPS/WSS for encrypted"
          >
            <SelectItem value="http" text="HTTP / WS" />
            <SelectItem value="https" text="HTTPS / WSS" />
          </Select>
        </div>

        <div className="form-row">
          <TextInput
            id="tsstore-host"
            labelText="Host"
            value={tsstoreConfig.host || ''}
            onChange={(e) => updateConfig('tsstore.host', e.target.value)}
            placeholder="localhost or 100.127.19.27"
            helperText="Hostname or IP address of the TSStore server"
          />
          <NumberInput
            id="tsstore-port"
            label="Port"
            value={tsstoreConfig.port || 21080}
            onChange={(e) => updateConfig('tsstore.port', e.imaginaryTarget.value)}
            min={1}
            max={65535}
            helperText="TSStore server port"
          />
        </div>

        <TextInput
          id="tsstore-store-name"
          labelText="Store Name"
          value={tsstoreConfig.store_name || ''}
          onChange={(e) => updateConfig('tsstore.store_name', e.target.value)}
          placeholder="my-timeseries-store"
          helperText="Name of the timeseries store to connect to"
        />

        <TextInput
          id="tsstore-api-key"
          labelText="API Key (optional)"
          type="password"
          value={tsstoreConfig.api_key === SECRET_MASKED_VALUE ? '' : (tsstoreConfig.api_key || '')}
          onChange={(e) => updateConfig('tsstore.api_key', e.target.value)}
          placeholder={tsstoreConfig.api_key === SECRET_MASKED_VALUE ? 'API key is set (enter new value to change)' : 'Enter API key'}
          helperText="API key for authentication (if required)"
        />

        <NumberInput
          id="tsstore-timeout"
          label="Timeout (seconds)"
          value={tsstoreConfig.timeout || 30}
          onChange={(e) => updateConfig('tsstore.timeout', e.imaginaryTarget.value)}
          min={1}
          max={300}
          helperText="Request timeout in seconds"
        />

        {/* Streaming/Push Configuration */}
        <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', color: 'var(--cds-text-secondary)' }}>
          Streaming Configuration (Optional)
        </h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-helper)', marginBottom: '1rem' }}>
          Configure how data is pushed from ts-store to the dashboard. These settings affect all charts using this connection.
        </p>

        <TextInput
          id="tsstore-filter"
          labelText="Filter"
          value={tsstoreConfig.push?.filter || ''}
          onChange={(e) => updateConfig('tsstore.push.filter', e.target.value)}
          placeholder="temperature"
          helperText="Substring filter - only records containing this text are sent"
        />

        <Toggle
          id="tsstore-filter-ignore-case"
          labelText="Case-insensitive filter"
          labelA="Off"
          labelB="On"
          toggled={tsstoreConfig.push?.filter_ignore_case || false}
          onToggle={(checked) => updateConfig('tsstore.push.filter_ignore_case', checked)}
        />

        {/* Aggregation Section */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--cds-layer-01)', borderRadius: '4px' }}>
          <Toggle
            id="tsstore-enable-aggregation"
            labelText="Enable time-window aggregation"
            labelA="Off"
            labelB="On"
            toggled={!!tsstoreConfig.push?.agg_window}
            onToggle={(checked) => {
              if (!checked) {
                // Clear all aggregation settings
                updateConfig('tsstore.push.agg_window', '');
                updateConfig('tsstore.push.agg_default', '');
                updateConfig('tsstore.push.agg_fields', '');
              } else {
                // Set a default window
                updateConfig('tsstore.push.agg_window', '1m');
              }
            }}
          />

          {tsstoreConfig.push?.agg_window && (
            <div style={{ marginTop: '1rem' }}>
              {/* Time Window */}
              <div className="form-row" style={{ marginBottom: '1rem' }}>
                <NumberInput
                  id="tsstore-agg-window-value"
                  label="Time Window"
                  value={parseInt(tsstoreConfig.push?.agg_window) || 1}
                  onChange={(e) => {
                    const unit = tsstoreConfig.push?.agg_window?.replace(/[0-9]/g, '') || 'm';
                    updateConfig('tsstore.push.agg_window', `${e.imaginaryTarget.value}${unit}`);
                  }}
                  min={1}
                  max={60}
                  helperText="Records are accumulated over this time period"
                />
                <Select
                  id="tsstore-agg-window-unit"
                  labelText="Unit"
                  value={tsstoreConfig.push?.agg_window?.replace(/[0-9]/g, '') || 'm'}
                  onChange={(e) => {
                    const value = parseInt(tsstoreConfig.push?.agg_window) || 1;
                    updateConfig('tsstore.push.agg_window', `${value}${e.target.value}`);
                  }}
                >
                  <SelectItem value="s" text="Seconds" />
                  <SelectItem value="m" text="Minutes" />
                  <SelectItem value="h" text="Hours" />
                </Select>
              </div>

              {/* Default Aggregations for Numeric Fields */}
              <fieldset style={{ border: '1px solid var(--cds-border-subtle-01)', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
                <legend style={{ padding: '0 0.5rem', color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
                  Default Aggregations for Numeric Fields
                </legend>
                <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper)', marginBottom: '0.75rem' }}>
                  Select which calculations to apply to all numeric fields (can select multiple):
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                  {['avg', 'sum', 'min', 'max', 'count', 'last'].map((func) => {
                    const currentDefaults = (tsstoreConfig.push?.agg_default || '').split(',').filter(Boolean);
                    const isChecked = currentDefaults.includes(func);
                    return (
                      <Checkbox
                        key={func}
                        id={`tsstore-agg-default-${func}`}
                        labelText={func === 'avg' ? 'Average' : func === 'sum' ? 'Sum' : func === 'min' ? 'Minimum' : func === 'max' ? 'Maximum' : func === 'count' ? 'Count' : 'Last'}
                        checked={isChecked}
                        onChange={(_, { checked }) => {
                          let newDefaults = currentDefaults.filter(f => f !== func);
                          if (checked) {
                            newDefaults.push(func);
                          }
                          updateConfig('tsstore.push.agg_default', newDefaults.join(','));
                        }}
                      />
                    );
                  })}
                </div>
              </fieldset>

              {/* Field-Specific Overrides */}
              <fieldset style={{ border: '1px solid var(--cds-border-subtle-01)', padding: '1rem', borderRadius: '4px' }}>
                <legend style={{ padding: '0 0.5rem', color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
                  Field Overrides (Optional)
                </legend>
                <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper)', marginBottom: '0.75rem' }}>
                  Override default aggregations for specific fields. Use Test Connection to discover available fields.
                </p>

                {/* Parse and display existing field overrides */}
                {(() => {
                  const aggFieldsStr = tsstoreConfig.push?.agg_fields || '';
                  const fieldOverrides = aggFieldsStr ? aggFieldsStr.split(',').map(part => {
                    const [field, funcs] = part.split(':');
                    return { field: field?.trim(), functions: (funcs || '').split('+').map(f => f.trim()).filter(Boolean) };
                  }).filter(f => f.field) : [];

                  return (
                    <>
                      {fieldOverrides.map((override, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--cds-layer-02)', borderRadius: '4px' }}>
                          <TextInput
                            id={`tsstore-field-override-name-${index}`}
                            labelText="Field"
                            size="sm"
                            value={override.field}
                            onChange={(e) => {
                              const newOverrides = [...fieldOverrides];
                              newOverrides[index].field = e.target.value;
                              const newStr = newOverrides.map(o => `${o.field}:${o.functions.join('+')}`).join(',');
                              updateConfig('tsstore.push.agg_fields', newStr);
                            }}
                            style={{ width: '150px' }}
                          />
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Aggregations</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {['avg', 'sum', 'min', 'max', 'count', 'last'].map((func) => (
                                <Checkbox
                                  key={func}
                                  id={`tsstore-field-${index}-${func}`}
                                  labelText={func}
                                  checked={override.functions.includes(func)}
                                  onChange={(_, { checked }) => {
                                    const newOverrides = [...fieldOverrides];
                                    if (checked) {
                                      newOverrides[index].functions.push(func);
                                    } else {
                                      newOverrides[index].functions = newOverrides[index].functions.filter(f => f !== func);
                                    }
                                    const newStr = newOverrides.map(o => `${o.field}:${o.functions.join('+')}`).join(',');
                                    updateConfig('tsstore.push.agg_fields', newStr);
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          <Button
                            kind="ghost"
                            size="sm"
                            hasIconOnly
                            renderIcon={TrashCan}
                            iconDescription="Remove override"
                            onClick={() => {
                              const newOverrides = fieldOverrides.filter((_, i) => i !== index);
                              const newStr = newOverrides.map(o => `${o.field}:${o.functions.join('+')}`).join(',');
                              updateConfig('tsstore.push.agg_fields', newStr);
                            }}
                            style={{ marginTop: '1rem' }}
                          />
                        </div>
                      ))}
                      <Button
                        kind="tertiary"
                        size="sm"
                        onClick={() => {
                          const newOverrides = [...fieldOverrides, { field: '', functions: ['avg'] }];
                          const newStr = newOverrides.map(o => `${o.field}:${o.functions.join('+')}`).join(',');
                          updateConfig('tsstore.push.agg_fields', newStr);
                        }}
                      >
                        + Add field override
                      </Button>
                    </>
                  );
                })()}
              </fieldset>

              <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper)', marginTop: '1rem', fontStyle: 'italic' }}>
                Non-numeric fields always use "last value" only.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPrometheusConfig = () => {
    const prometheusConfig = config.prometheus || {};
    return (
      <div className="config-form">
        <TextInput
          id="prometheus-url"
          labelText="Prometheus URL"
          value={prometheusConfig.url || ''}
          onChange={(e) => updateConfig('prometheus.url', e.target.value)}
          placeholder="http://localhost:9090"
          helperText="Base URL of the Prometheus server"
        />

        <TextInput
          id="prometheus-username"
          labelText="Username (optional)"
          value={prometheusConfig.username || ''}
          onChange={(e) => updateConfig('prometheus.username', e.target.value)}
          placeholder="Enter username for basic auth"
          helperText="Username for basic authentication (if required)"
        />

        <TextInput
          id="prometheus-password"
          labelText="Password (optional)"
          type="password"
          value={prometheusConfig.password === SECRET_MASKED_VALUE ? '' : (prometheusConfig.password || '')}
          onChange={(e) => updateConfig('prometheus.password', e.target.value)}
          placeholder={prometheusConfig.password === SECRET_MASKED_VALUE ? 'Password is set (enter new value to change)' : 'Enter password'}
          helperText="Password for basic authentication (if required)"
        />

        <NumberInput
          id="prometheus-timeout"
          label="Timeout (seconds)"
          value={prometheusConfig.timeout || 30}
          onChange={(e) => updateConfig('prometheus.timeout', e.imaginaryTarget.value)}
          min={1}
          max={300}
          helperText="Query timeout in seconds"
        />
      </div>
    );
  };

  const renderEdgeLakeConfig = () => {
    const elConfig = config.edgelake || {};
    return (
      <div className="config-form">
        <div className="form-row">
          <TextInput
            id="edgelake-host"
            labelText="Host"
            value={elConfig.host || ''}
            onChange={(e) => updateConfig('edgelake.host', e.target.value)}
            placeholder="192.168.1.100 or edgelake.example.com"
            helperText="IP address or hostname of the EdgeLake node"
          />
          <NumberInput
            id="edgelake-port"
            label="Port"
            value={elConfig.port || 32049}
            onChange={(e) => updateConfig('edgelake.port', e.imaginaryTarget.value)}
            min={1}
            max={65535}
            helperText="REST API port (default: 32049)"
          />
        </div>

        <NumberInput
          id="edgelake-timeout"
          label="Timeout (seconds)"
          value={elConfig.timeout || 20}
          onChange={(e) => updateConfig('edgelake.timeout', e.imaginaryTarget.value)}
          min={1}
          max={300}
          helperText="Request timeout in seconds"
        />

        <Checkbox
          id="edgelake-distributed"
          labelText="Enable distributed queries (send to all network nodes)"
          checked={elConfig.use_distributed_query || false}
          onChange={(e) => updateConfig('edgelake.use_distributed_query', e.target.checked)}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="connection-detail-page">
        <Loading description="Loading connection..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="connection-detail-page">
        <div className="error-message">Error: {error}</div>
        <Button onClick={() => navigate('/design/connections')}>Back to Connections</Button>
      </div>
    );
  }

  return (
    <div className="connection-detail-page">
      {/* Page header bar with title and actions */}
      <div className="page-header-bar">
        <div className="header-left">
          <Button
            kind="ghost"
            renderIcon={ArrowLeft}
            onClick={() => navigate('/design/connections')}
            size="md"
          >
            Back
          </Button>
          <h1>{isCreateMode ? 'Create Connection' : 'Edit Connection'}</h1>
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
            onClick={() => setShowSaveModal(true)}
            disabled={!name || !type}
            size="md"
          >
            Save Connection
          </Button>
        </div>
      </div>

      {/* Form content */}
      <div className="form-content">
        {/* Connection Name - full width */}
        <div className="form-row">
          <TextInput
            id="connection-name"
            labelText="Connection Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasChanges(true);
              if (nameError) setNameError('');
            }}
            onBlur={(e) => checkDuplicateConnectionName(e.target.value)}
            placeholder="Enter connection name"
            invalid={!!nameError}
            invalidText={nameError}
          />
        </div>

        {/* Description - full width */}
        <div className="form-row">
          <TextInput
            id="connection-description"
            labelText="Description (optional)"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Enter connection description"
          />
        </div>

        {/* Type selector */}
        <div className="form-row">
          <Select
            id="connection-type"
            labelText="Connection Type"
            value={type}
            onChange={handleTypeChange}
            disabled={!isCreateMode}
          >
            <SelectItem value="sql" text="SQL Database" />
            <SelectItem value="csv" text="CSV File" />
            <SelectItem value="socket" text="Socket/WebSocket" />
            <SelectItem value="api" text="REST API" />
            <SelectItem value="tsstore" text="TSStore (Timeseries)" />
            <SelectItem value="prometheus" text="Prometheus" />
            <SelectItem value="edgelake" text="EdgeLake" />
          </Select>
        </div>

        {/* Type-specific configuration */}
        <div className="config-section">
          <div className="config-section-header">
            <h3>Configuration</h3>
            <Button
              kind="tertiary"
              renderIcon={ConnectionSignal}
              onClick={handleTestConnection}
              disabled={testing}
              size="sm"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
          {type === 'sql' && renderSQLConfig()}
          {type === 'csv' && renderCSVConfig()}
          {type === 'socket' && renderSocketConfig()}
          {type === 'api' && renderAPIConfig()}
          {type === 'tsstore' && renderTSStoreConfig()}
          {type === 'prometheus' && renderPrometheusConfig()}
          {type === 'edgelake' && renderEdgeLakeConfig()}
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
          modalHeading={isCreateMode ? "Create Connection" : "Save Changes"}
          primaryButtonText={saving ? "Saving..." : "Save"}
          secondaryButtonText="Cancel"
          primaryButtonDisabled={saving}
        >
          <p>
            {isCreateMode
              ? `Create connection "${name}" of type ${type}?`
              : `Save changes to connection "${name}"?`}
          </p>
        </Modal>
      )}

      {/* Test Connection Results Modal */}
      {showTestModal && testResult && (
        <Modal
          open={true}
          onRequestClose={() => {
            setShowTestModal(false);
            setTestResult(null);
            setTestSchema(null);
          }}
          modalHeading="Connection Test Results"
          passiveModal
          size="md"
          className="test-connection-modal"
        >
          <div className="test-result-content">
            {/* Status indicator */}
            <div className={`test-status ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? (
                <Checkmark size={24} />
              ) : (
                <ErrorFilled size={24} />
              )}
              <span className="status-text">
                {testResult.success ? 'Connection Successful' : 'Connection Failed'}
              </span>
            </div>

            {/* Message */}
            {testResult.message && (
              <p className="test-message">{testResult.message}</p>
            )}

            {/* Response time */}
            {testResult.response_time && (
              <p className="response-time">
                Response time: {testResult.response_time}ms
              </p>
            )}

            {/* Schema information for SQL connections */}
            {testResult.success && testSchema && testSchema.tables && (
              <div className="schema-info">
                <h4>Database Schema</h4>
                <p className="schema-count">{testSchema.tables.length} tables found</p>
                <div className="schema-tables">
                  {testSchema.tables.map((table) => (
                    <div key={table.name} className="schema-table">
                      <div className="table-name">{table.name}</div>
                      <div className="table-columns">
                        {table.columns && table.columns.map((col) => (
                          <Tag key={col.name} size="sm" type="cool-gray">
                            {col.name}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ConnectionDetailPage;
