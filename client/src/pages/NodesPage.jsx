import { Tile, Tag } from '@carbon/react';
import { VirtualMachine, Checkmark, WarningAlt } from '@carbon/icons-react';
import './NodesPage.scss';

function NodesPage() {
  // Mock node data
  const nodes = [
    { id: 'node-01', name: 'data source Node 01', status: 'active', location: 'US-East', cpu: 45, memory: 62, queries: 1234 },
    { id: 'node-02', name: 'data source Node 02', status: 'active', location: 'US-West', cpu: 38, memory: 58, queries: 987 },
    { id: 'node-03', name: 'data source Node 03', status: 'active', location: 'EU-Central', cpu: 52, memory: 71, queries: 1456 },
    { id: 'node-04', name: 'data source Node 04', status: 'active', location: 'Asia-Pacific', cpu: 41, memory: 65, queries: 1089 },
    { id: 'node-05', name: 'data source Node 05', status: 'inactive', location: 'US-Central', cpu: 0, memory: 0, queries: 0 },
  ];

  return (
    <div className="nodes-page">
      <div className="page-header">
        <h2>Cluster Nodes</h2>
        <p>Monitor and manage database cluster nodes</p>
      </div>

      <div className="nodes-grid">
        {nodes.map(node => (
          <Tile key={node.id} className={`node-card node-card--${node.status}`}>
            <div className="node-card__header">
              <div className="node-card__icon">
                <VirtualMachine size={32} />
              </div>
              <div className="node-card__info">
                <h4>{node.name}</h4>
                <span className="node-card__location">{node.location}</span>
              </div>
              <Tag
                type={node.status === 'active' ? 'green' : 'red'}
                size="sm"
              >
                {node.status === 'active' ? (
                  <>
                    <Checkmark size={16} />
                    <span>Active</span>
                  </>
                ) : (
                  <>
                    <WarningAlt size={16} />
                    <span>Inactive</span>
                  </>
                )}
              </Tag>
            </div>

            {node.status === 'active' && (
              <div className="node-card__metrics">
                <div className="metric">
                  <span className="metric__label">CPU Usage</span>
                  <span className="metric__value">{node.cpu}%</span>
                  <div className="metric__bar">
                    <div
                      className="metric__bar-fill metric__bar-fill--cpu"
                      style={{ width: `${node.cpu}%` }}
                    />
                  </div>
                </div>

                <div className="metric">
                  <span className="metric__label">Memory Usage</span>
                  <span className="metric__value">{node.memory}%</span>
                  <div className="metric__bar">
                    <div
                      className="metric__bar-fill metric__bar-fill--memory"
                      style={{ width: `${node.memory}%` }}
                    />
                  </div>
                </div>

                <div className="metric">
                  <span className="metric__label">Total Queries</span>
                  <span className="metric__value">{node.queries.toLocaleString()}</span>
                </div>
              </div>
            )}
          </Tile>
        ))}
      </div>
    </div>
  );
}

export default NodesPage;
