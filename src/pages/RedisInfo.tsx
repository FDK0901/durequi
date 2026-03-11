import { useState } from 'react';
import { useRedisInfo } from '../hooks';
import type { RedisNodeInfo } from '../api';

function NodeSections({ node }: { node: RedisNodeInfo }) {
  const sectionNames = Object.keys(node.sections).sort();

  return (
    <>
      {sectionNames.map((section) => (
        <details key={section} open={section === 'server' || section === 'memory' || section === 'clients'}>
          <summary className="redis-section-title">{section}</summary>
          <table className="redis-info-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(node.sections[section]).map(([key, value]) => (
                <tr key={key}>
                  <td className="redis-key">{key}</td>
                  <td className="redis-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </>
  );
}

export default function RedisInfo() {
  const { data, isLoading, error } = useRedisInfo();
  const [selectedNode, setSelectedNode] = useState(0);

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!data || !data.nodes?.length) return null;

  const isCluster = data.mode === 'cluster';
  const node = data.nodes[selectedNode] ?? data.nodes[0];

  return (
    <div className="page">
      <h2>
        Redis Info
        <span className="redis-mode-badge" data-mode={data.mode}>
          {isCluster ? `Cluster (${data.nodes.length} nodes)` : 'Standalone'}
        </span>
      </h2>

      {isCluster && (
        <div className="redis-node-tabs">
          {data.nodes.map((n, i) => (
            <button
              key={n.addr}
              className={`redis-node-tab ${i === selectedNode ? 'active' : ''}`}
              onClick={() => setSelectedNode(i)}
            >
              <span className={`redis-role-dot ${n.role}`} />
              {n.addr}
              <span className="redis-role-label">{n.role}</span>
            </button>
          ))}
        </div>
      )}

      <NodeSections node={node} />
    </div>
  );
}
