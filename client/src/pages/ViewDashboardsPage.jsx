import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tile,
  Loading,
  Tag,
  Search
} from '@carbon/react';
import { Dashboard, View, Time, ChartMultitype } from '@carbon/icons-react';
import './ViewDashboardsPage.scss';

/**
 * ViewDashboardsPage Component
 *
 * Displays available dashboards in a tile/card format for View Mode.
 * Users can select a dashboard to view it in full-screen mode.
 */
function ViewDashboardsPage() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDashboards();
  }, []);

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/dashboards?page=1&page_size=100');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.dashboards) {
        setDashboards(data.dashboards);
      } else if (data.error) {
        setError(data.error);
      } else {
        setDashboards([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDashboard = (dashboard) => {
    navigate(`/view/dashboards/${dashboard.id}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getComponentCount = (dashboard) => {
    return dashboard.components?.filter(c => c.component_id).length || 0;
  };

  const filteredDashboards = dashboards.filter(dashboard =>
    dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dashboard.description && dashboard.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="view-dashboards-page">
        <Loading description="Loading dashboards..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="view-dashboards-page">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="view-dashboards-page">
      <div className="page-header">
        <div className="header-content">
          <Dashboard size={32} className="header-icon" />
          <div className="header-text">
            <h1>Dashboards</h1>
            <p>Select a dashboard to view</p>
          </div>
        </div>
        <div className="header-search">
          <Search
            id="dashboard-search"
            labelText="Search dashboards"
            placeholder="Search by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="lg"
          />
        </div>
      </div>

      {filteredDashboards.length === 0 ? (
        <div className="no-dashboards">
          <ChartMultitype size={64} />
          <h3>No dashboards found</h3>
          <p>
            {searchTerm
              ? 'No dashboards match your search. Try a different term.'
              : 'Create dashboards in Design Mode to view them here.'}
          </p>
        </div>
      ) : (
        <div className="dashboards-grid">
          {filteredDashboards.map((dashboard) => (
            <Tile
              key={dashboard.id}
              className="dashboard-tile"
              onClick={() => handleViewDashboard(dashboard)}
            >
              <div className="tile-header">
                <ChartMultitype size={24} className="tile-icon" />
                <h3>{dashboard.name}</h3>
              </div>

              <p className="tile-description">
                {dashboard.description || 'No description'}
              </p>

              <div className="tile-stats">
                <div className="stat">
                  <View size={16} />
                  <span>{getComponentCount(dashboard)} components</span>
                </div>
                <div className="stat">
                  <Time size={16} />
                  <span>{formatDate(dashboard.updated)}</span>
                </div>
              </div>

              <div className="tile-tags">
                {dashboard.settings?.theme && (
                  <Tag type="blue" size="sm">{dashboard.settings.theme} theme</Tag>
                )}
                {dashboard.settings?.refresh_interval > 0 && (
                  <Tag type="green" size="sm">Auto-refresh</Tag>
                )}
                {dashboard.settings?.is_public && (
                  <Tag type="purple" size="sm">Public</Tag>
                )}
              </div>

              <div className="tile-action">
                <span>Click to view</span>
                <View size={20} />
              </div>
            </Tile>
          ))}
        </div>
      )}
    </div>
  );
}

export default ViewDashboardsPage;
