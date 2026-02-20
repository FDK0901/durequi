import { useRedisInfo } from '../hooks';

export default function RedisInfo() {
  const { data: sections, isLoading, error } = useRedisInfo();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!sections) return null;

  const sectionNames = Object.keys(sections).sort();

  return (
    <div className="page">
      <h2>Redis Info</h2>

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
              {Object.entries(sections[section]).map(([key, value]) => (
                <tr key={key}>
                  <td className="redis-key">{key}</td>
                  <td className="redis-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}
