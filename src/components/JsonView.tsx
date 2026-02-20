/**
 * Lightweight JSON syntax highlighter using CSS classes.
 * No external dependencies required.
 */

function highlightJSON(value: unknown, indent = 0): JSX.Element[] {
  const pad = '  '.repeat(indent);
  const elements: JSX.Element[] = [];
  let key = 0;

  if (value === null) {
    elements.push(<span key={key++} className="json-null">null</span>);
  } else if (typeof value === 'boolean') {
    elements.push(<span key={key++} className="json-boolean">{String(value)}</span>);
  } else if (typeof value === 'number') {
    elements.push(<span key={key++} className="json-number">{value}</span>);
  } else if (typeof value === 'string') {
    elements.push(<span key={key++} className="json-string">"{value}"</span>);
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      elements.push(<span key={key++} className="json-bracket">[]</span>);
    } else {
      elements.push(<span key={key++} className="json-bracket">[</span>);
      elements.push(<br key={key++} />);
      value.forEach((item, i) => {
        elements.push(<span key={key++}>{pad}{'  '}</span>);
        elements.push(...highlightJSON(item, indent + 1));
        if (i < value.length - 1) {
          elements.push(<span key={key++} className="json-comma">,</span>);
        }
        elements.push(<br key={key++} />);
      });
      elements.push(<span key={key++}>{pad}</span>);
      elements.push(<span key={key++} className="json-bracket">]</span>);
    }
  } else if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      elements.push(<span key={key++} className="json-bracket">{'{}'}</span>);
    } else {
      elements.push(<span key={key++} className="json-bracket">{'{'}</span>);
      elements.push(<br key={key++} />);
      entries.forEach(([k, v], i) => {
        elements.push(<span key={key++}>{pad}{'  '}</span>);
        elements.push(<span key={key++} className="json-key">"{k}"</span>);
        elements.push(<span key={key++} className="json-comma">: </span>);
        elements.push(...highlightJSON(v, indent + 1));
        if (i < entries.length - 1) {
          elements.push(<span key={key++} className="json-comma">,</span>);
        }
        elements.push(<br key={key++} />);
      });
      elements.push(<span key={key++}>{pad}</span>);
      elements.push(<span key={key++} className="json-bracket">{'}'}</span>);
    }
  } else {
    elements.push(<span key={key++}>{String(value)}</span>);
  }

  return elements;
}

export function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="payload-block">
      <code>{highlightJSON(data)}</code>
    </pre>
  );
}
