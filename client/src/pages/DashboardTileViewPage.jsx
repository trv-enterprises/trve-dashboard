import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loading,
  Tag,
  Search
} from '@carbon/react';
import {
  Dashboard,
  Time
} from '@carbon/icons-react';
import apiClient from '../api/client';
import './DashboardTileViewPage.scss';

/**
 * DashboardTileViewPage Component
 *
 * Landing page for View Mode showing all dashboards as tiles in a grid.
 * Each tile shows:
 * - Thumbnail image (if available)
 * - Dashboard name
 * - Description (truncated)
 * - Auto-refresh indicator
 */
function DashboardTileViewPage() {
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
      const response = await apiClient.getDashboards({ page: 1, page_size: 100 });
      if (response.dashboards) {
        setDashboards(response.dashboards);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTileClick = (dashboardId) => {
    navigate(`/view/dashboards/${dashboardId}`);
  };

  const filteredDashboards = dashboards.filter(dashboard =>
    dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dashboard.description && dashboard.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="dashboard-tile-view-page">
        <Loading description="Loading dashboards..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-tile-view-page">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-tile-view-page">
      <div className="tile-view-header">
        <div className="header-title">
          <Dashboard size={24} />
          <h1>Dashboards</h1>
        </div>
      </div>
      <div className="header-search">
        <Search
          size="lg"
          placeholder="Search dashboards..."
          labelText="Search"
          closeButtonLabelText="Clear search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredDashboards.length === 0 ? (
        <div className="no-dashboards">
          {searchTerm ? (
            <p>No dashboards match your search.</p>
          ) : (
            <p>No dashboards available. Create one in Design mode.</p>
          )}
        </div>
      ) : (
        <div className="dashboard-tiles-grid">
          {filteredDashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              className="dashboard-tile"
              onClick={() => handleTileClick(dashboard.id)}
            >
              <div className="tile-thumbnail">
                {dashboard.thumbnail ? (
                  <img src={dashboard.thumbnail} alt={dashboard.name} />
                ) : (
                  <div className="thumbnail-placeholder">
                    <Dashboard size={48} />
                  </div>
                )}
              </div>
              <div className="tile-content">
                <h3 className="tile-name">{dashboard.name}</h3>
                {dashboard.description && (
                  <p className="tile-description">{dashboard.description}</p>
                )}
                <div className="tile-tags">
                  {dashboard.settings?.refresh_interval > 0 && (
                    <Tag type="green" size="sm">
                      <Time size={12} />
                      {dashboard.settings.refresh_interval}s
                    </Tag>
                  )}
                  {dashboard.panels?.length > 0 && (
                    <Tag type="gray" size="sm">
                      {dashboard.panels.length} panel{dashboard.panels.length !== 1 ? 's' : ''}
                    </Tag>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DashboardTileViewPage;
