import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Link,
  NavLink,
  Route,
  BrowserRouter as Router,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { apiGet, formatTime, short } from './api';
import './styles.css';

type Page<T> = { total: number; page: number; perPage: number; slice: T[] };
type AnyRecord = Record<string, any>;

function ageFrom(value?: string | number): string {
  if (value === undefined || value === null || value === '') return '';
  const timestamp = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(timestamp)) return String(value);
  const diffMs = Date.now() - timestamp;
  const seconds = Math.max(Math.floor(diffMs / 1000), 0);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header>
        <div className="site-navbar shadow-sm">
          <div className="site-navbar-inner">
            <nav className="site-nav">
              <Link to="/" className="navbar-brand">
                <img src="/logo-header.png" alt="BORLAUG WEB SERVICES" height={30} />
              </Link>
              <ul className="navbar-nav">
                <li>
                  <NavLink to="/" className="nav-link" end>
                    Home
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/transactions" className="nav-link">
                    Transactions
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/blocks" className="nav-link">
                    Blocks
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/accounts" className="nav-link">
                    Accounts
                  </NavLink>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="site-footer">
        <div className="footer-row">
          <div className="footer-col footer-brand-col">
            <div className="footer-logo-wrap">
              <img src="/logo-footer.png" alt="BORLAUG WEB SERVICES" height={30} />
            </div>
            <small className="footer-copy">© 2017-2020</small>
          </div>
          <div className="footer-col">
            <h5>About Us</h5>
            <ul className="footer-links">
              <li>
                <a href="https://www.borlaug.ws/" target="_blank" rel="noreferrer">
                  Company
                </a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Contact Us</h5>
            <ul className="footer-links">
              <li>
                <a href="mailto:info@borlaug.ws">info@borlaug.ws</a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Resources</h5>
            <ul className="footer-links">
              <li>
                <a href="https://www.borlaug.ws/bws-sales-private" target="_blank" rel="noreferrer">
                  Documentation
                </a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Legal</h5>
            <ul className="footer-links">
              <li>
                <Link to="/privacy">Privacy</Link>
              </li>
              <li>
                <Link to="/terms">Terms</Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </>
  );
}

function Card({ title, icon, children }: { title?: string; icon?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      {title && (
        <div className="card-title">
          <h3>{title}</h3>
          <span>{icon}</span>
        </div>
      )}
      {children}
    </section>
  );
}

function Spinner({ label = 'Loading', showLabel = false }: { label?: string; showLabel?: boolean }) {
  return (
    <div className="spinner" role="status" aria-live="polite" aria-label={label}>
      <span className="wave-loader" aria-hidden="true">
        <span className="wave-loader-bar" />
        <span className="wave-loader-bar" />
        <span className="wave-loader-bar" />
      </span>
      {showLabel && <span className="spinner-text">{label}…</span>}
    </div>
  );
}

function Pager({
  page,
  total,
  perPage,
  disabled = false,
}: {
  page: number;
  total: number;
  perPage: number;
  disabled?: boolean;
}) {
  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const prev = Math.max(page - 1, 1);
  const next = Math.min(page + 1, totalPages);
  return (
    <div className={`pager${disabled ? ' is-disabled' : ''}`} aria-disabled={disabled}>
      {disabled ? (
        <span className="pager-disabled">Prev</span>
      ) : (
        <Link to={`?page=${prev}`}>Prev</Link>
      )}
      <span>{page}</span>
      <span>...</span>
      {disabled ? (
        <span className="pager-disabled">{totalPages}</span>
      ) : (
        <Link to={`?page=${totalPages}`}>{totalPages}</Link>
      )}
      {disabled ? (
        <span className="pager-disabled">Next</span>
      ) : (
        <Link to={`?page=${next}`}>Next</Link>
      )}
    </div>
  );
}

function SearchBox({ initial = '' }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setQ(initial);
  }, [initial]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      apiGet<AnyRecord>(`/search?q=${encodeURIComponent(term)}`)
        .then((data) => setResults(data.results || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
      if (window.location.pathname === '/search' || window.location.pathname === '/') {
        navigate(`/search?q=${encodeURIComponent(term)}`, { replace: true });
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [q, navigate]);

  return (
    <div className="search">
      <h3>Explore Blocks, Transactions and Addresses</h3>
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Search by Block Number / Txhash / Lease / DID / Audit / Provenance"
      />
      {q.trim().length >= 2 && (
        <div className="search-live">
          {loading && (
            <div className="home-loader" style={{ minHeight: 80, padding: '16px 0' }}>
              <Spinner label="Searching" />
            </div>
          )}
          {!loading && results.length === 0 && <div className="muted">No matches</div>}
          {!loading &&
            results.map((item) => (
              <Link key={`${item.type}-${item.url}`} to={item.url} className="search-live-item">
                <strong>{item.type}</strong>
                <span>{item.label}</span>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}

function Table({
  rows,
  columns,
  link,
  renderCell,
}: {
  rows: AnyRecord[];
  columns: { key: string; label: string }[];
  link?: (row: AnyRecord) => string;
  renderCell?: (row: AnyRecord, key: string) => React.ReactNode;
}) {
  const read = (row: AnyRecord, column: string) => column.split('.').reduce((acc, part) => acc?.[part], row);
  const display = (value: unknown) => {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return short(JSON.stringify(value), 22);
    return short(value as string | number | undefined, 22);
  };

  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
          {link && <th />}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id || row.hash || row.number || row.signer || index}>
            {columns.map((col) => (
              <td key={col.key}>{renderCell ? renderCell(row, col.key) : display(read(row, col.key))}</td>
            ))}
            {link && (
              <td>
                <Link className="btn" to={link(row)}>
                  Details
                </Link>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Home() {
  const [data, setData] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<AnyRecord>('/stats/latest')
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const latestBlockTime = data?.latestBlocks?.[0]?.timestamp;
  const latestTxTime = data?.latestTransactions?.[0]?.timestamp;
  const blocks = data?.latestBlocks || [];
  const transactions = data?.latestTransactions || [];

  return (
    <Layout>
      <SearchBox />
      <div className="grid two">
        <Card title="Latest Blocks" icon="▧">
          {loading ? (
            <div className="home-loader">
              <Spinner label="Loading blocks" />
            </div>
          ) : (
            <Table
              rows={blocks}
              columns={[
                { key: 'number', label: 'Number' },
                { key: 'age', label: 'Age' },
                { key: 'transactions', label: 'Transactions' },
                { key: 'events', label: 'Events' },
              ]}
              renderCell={(row, key) => {
                if (key === 'number') return <Link to={`/blocks/${row.number}`}>{row.number}</Link>;
                if (key === 'age') return ageFrom(row.timestamp);
                if (key === 'transactions' || key === 'events') return Array.isArray(row[key]) ? row[key].length : row[key] ?? 0;
                return String(row[key] ?? '');
              }}
              link={(row) => `/blocks/${row.number}`}
            />
          )}
          <div className="card-meta">Last Synced Block Time: {formatTime(latestBlockTime)}</div>
          <Link className="btn btn-block" to="/blocks">
            View All Blocks
          </Link>
        </Card>

        <Card title="Latest Transactions" icon="▰">
          {loading ? (
            <div className="home-loader">
              <Spinner label="Loading transactions" />
            </div>
          ) : (
            <Table
              rows={transactions}
              columns={[
                { key: 'hash', label: 'Hash' },
                { key: 'blockNumber', label: 'Block' },
                { key: 'method.method', label: 'Method' },
              ]}
              renderCell={(row, key) => {
                if (key === 'hash') {
                  return <Link to={`/transactions/${row.blockNumber}/${row.hash}`}>{short(row.hash, 12)}</Link>;
                }
                if (key === 'blockNumber') return <Link to={`/blocks/${row.blockNumber}`}>{row.blockNumber}</Link>;
                if (key === 'method.method') return row.method?.method || '';
                return String(row[key] ?? '');
              }}
              link={(row) => `/transactions/${row.blockNumber}/${row.hash}`}
            />
          )}
          <div className="card-meta">Last Synced Transaction Time: {formatTime(latestTxTime)}</div>
          <Link className="btn btn-block" to="/transactions">
            View All Transaction
          </Link>
        </Card>
      </div>
    </Layout>
  );
}

function ListPage({
  title,
  endpoint,
  columns,
  link,
  renderCell,
}: {
  title: string;
  endpoint: string;
  columns: { key: string; label: string }[];
  link: (row: AnyRecord) => string;
  renderCell?: (row: AnyRecord, key: string) => React.ReactNode;
}) {
  const [params] = useSearchParams();
  const page = Number(params.get('page') || '1');
  const [data, setData] = useState<Page<AnyRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    apiGet<Page<AnyRecord>>(`${endpoint}?page=${page}&perPage=10`)
      .then((result) => {
        if (!active) return;
        setData(result);
      })
      .catch(() => {
        if (!active) return;
        setError('Failed to load data. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [endpoint, page]);

  const showing = data?.slice?.length || 0;
  const total = data?.total || 0;
  const hasData = Boolean(data?.slice?.length);

  return (
    <Layout>
      <h1>{title}</h1>
      <Card title={loading && !hasData ? 'Loading…' : `Showing ${showing} of ${total}`}>
        <div className={`list-panel${loading ? ' is-loading' : ''}`} aria-busy={loading}>
          {loading && !hasData && (
            <div className="list-loader list-loader-initial">
              <Spinner label={`Loading ${title.toLowerCase()}`} />
            </div>
          )}

          {hasData && (
            <div className="list-content">
              <Table rows={data!.slice} columns={columns} link={link} renderCell={renderCell} />
              <Pager
                page={data!.page}
                total={data!.total}
                perPage={data!.perPage}
                disabled={loading}
              />
            </div>
          )}

          {loading && hasData && (
            <div className="list-loader list-loader-overlay">
              <Spinner label="Loading page" />
            </div>
          )}

          {!loading && !hasData && (
            <div className="list-empty muted">{error || 'No results found.'}</div>
          )}
        </div>
      </Card>
    </Layout>
  );
}

function Transactions() {
  return (
    <ListPage
      title="Transactions"
      endpoint="/transactions"
      columns={[
        { key: 'hash', label: 'Hash' },
        { key: 'blockNumber', label: 'Block' },
        { key: 'age', label: 'Age' },
        { key: 'method.section', label: 'Module' },
        { key: 'method.method', label: 'Method' },
      ]}
      renderCell={(row, key) => {
        if (key === 'hash') return <Link to={`/transactions/${row.blockNumber}/${row.hash}`}>{short(row.hash, 16)}</Link>;
        if (key === 'blockNumber') return <Link to={`/blocks/${row.blockNumber}`}>{row.blockNumber}</Link>;
        if (key === 'age') return ageFrom(row.timestamp);
        if (key === 'method.section') return row.method?.section || '';
        if (key === 'method.method') return row.method?.method || '';
        return String(row[key] ?? '');
      }}
      link={(row) => `/transactions/${row.blockNumber}/${row.hash}`}
    />
  );
}

function Blocks() {
  return (
    <ListPage
      title="Blocks"
      endpoint="/blocks"
      columns={[
        { key: 'number', label: 'Number' },
        { key: 'age', label: 'Age' },
        { key: 'transactions', label: 'Transactions' },
        { key: 'inherents', label: 'Inherents' },
        { key: 'events', label: 'Events' },
        { key: 'logs', label: 'Logs' },
      ]}
      renderCell={(row, key) => {
        if (key === 'number') return <Link to={`/blocks/${row.number}`}>{row.number}</Link>;
        if (key === 'age') return ageFrom(row.timestamp);
        if (['transactions', 'inherents', 'events', 'logs'].includes(key)) {
          return Array.isArray(row[key]) ? row[key].length : row[key] ?? 0;
        }
        return String(row[key] ?? '');
      }}
      link={(row) => `/blocks/${row.number}`}
    />
  );
}

function Accounts() {
  return (
    <ListPage
      title="Accounts"
      endpoint="/accounts"
      columns={[
        { key: 'signer', label: 'Address' },
        { key: 'count', label: 'No. of Transactions' },
      ]}
      link={(row) => `/accounts/${row.signer}`}
    />
  );
}

function DetailRows({
  data,
  fields,
}: {
  data: AnyRecord;
  fields: { key: string; label: string; render?: (value: any, data: AnyRecord) => React.ReactNode }[];
}) {
  return (
    <dl className="details">
      {fields.map((field) => {
        const value = field.key.split('.').reduce((acc: any, part) => acc?.[part], data);
        return (
          <React.Fragment key={field.key}>
            <dt>{field.label}</dt>
            <dd>
              {field.render
                ? field.render(value, data)
                : field.key.toLowerCase().includes('timestamp')
                  ? formatTime(value)
                  : typeof value === 'object'
                    ? <pre>{JSON.stringify(value, null, 2)}</pre>
                    : String(value ?? '')}
            </dd>
          </React.Fragment>
        );
      })}
    </dl>
  );
}

function TransactionDetail() {
  const { blockNumber, hash } = useParams();
  const [data, setData] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiGet<AnyRecord>(`/transactions/${blockNumber}/${hash}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) {
          setData(null);
          setError('Failed to load transaction');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [blockNumber, hash]);

  if (error) return <Layout><Card>{error}</Card></Layout>;
  if (loading || !data) {
    return (
      <Layout>
        <Card>
          <div className="detail-loader">
            <Spinner label="Loading transaction" />
          </div>
        </Card>
      </Layout>
    );
  }

  const events = Array.isArray(data.events)
    ? data.events.map((event: AnyRecord) => (typeof event === 'string' ? { id: event, meta: { name: event } } : event))
    : [];
  const identity = data.identity;
  const incomplete = data.detail_status && data.detail_status !== 'done';

  return (
    <Layout>
      <h1>Transactions</h1>
      <Card title={`Transaction ${short(data.hash, 80)}`} icon="▰">
        {incomplete && (
          <div className="notice">
            Detail scrape is still `{data.detail_status}`. Events/Identifier appear after transaction detail scraping finishes.
          </div>
        )}
        <DetailRows
          data={{
            ...data,
            module: data.method?.section,
            call: data.method?.method,
            description: Array.isArray(data.method?.documentation) ? data.method.documentation.join(' ') : '',
            parameters: data.method?.args,
          }}
          fields={[
            {
              key: 'blockNumber',
              label: 'Block',
              render: (value) => <Link to={`/blocks/${value}`}>{value}</Link>,
            },
            { key: 'timestamp', label: 'Timestamp' },
            { key: 'index', label: 'Transaction Index' },
            { key: 'hash', label: 'Transaction Hash' },
            {
              key: 'status',
              label: 'Status',
              render: () => <span className="badge success">SUCCESS</span>,
            },
            { key: 'module', label: 'Module' },
            { key: 'call', label: 'Call' },
            { key: 'description', label: 'Description' },
            { key: 'signer', label: 'Address' },
            { key: 'nonce', label: 'Nonce' },
            { key: 'signature', label: 'Signature' },
            { key: 'parameters', label: 'Parameters' },
          ]}
        />
      </Card>

      <Card title="Triggered Events">
        {events.length === 0 ? (
          <div className="muted">No triggered events available yet.</div>
        ) : (
          <Table
            rows={events}
            columns={[
              { key: 'id', label: 'Event ID' },
              { key: 'meta.name', label: 'Event' },
            ]}
            renderCell={(row, key) => {
              if (key === 'id') return <Link to={`/events/${row.id}`}>{row.id}</Link>;
              if (key === 'meta.name') return row.meta?.name || row.event || '';
              return String(row[key] ?? '');
            }}
            link={(row) => `/events/${row.id}`}
          />
        )}
      </Card>

      {identity && (
        <Card title="Identifier" icon="▧">
          <DetailRows
            data={identity}
            fields={[
              {
                key: 'did',
                label: 'DID',
                render: (value) => <Link to={`/identities/${value}`}>{value}</Link>,
              },
              {
                key: 'blockNumber',
                label: 'Block Number',
                render: (value) => <Link to={`/blocks/${value}`}>{value}</Link>,
              },
              {
                key: 'blockHash',
                label: 'Block Hash',
                render: (value) => <Link to={`/blocks/${identity.blockNumber}`}>{value}</Link>,
              },
              {
                key: 'extrinsicHash',
                label: 'Transaction Hash',
                render: (value) => (
                  <Link to={`/transactions/${identity.blockNumber}/${value}`}>{value}</Link>
                ),
              },
              { key: 'subject', label: 'Subject' },
              { key: 'controller', label: 'Controller' },
              { key: 'properties', label: 'Properties' },
              { key: 'claims', label: 'Claims' },
            ]}
          />
        </Card>
      )}
    </Layout>
  );
}

function BlockDetail() {
  const { number } = useParams();
  const [data, setData] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'transactions' | 'inherents' | 'events' | 'logs'>('transactions');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiGet<AnyRecord>(`/blocks/${number}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) {
          setData(null);
          setError('Failed to load block');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [number]);

  const transactions = useMemo(() => {
    if (!data?.transactions) return [];
    return data.transactions.map((item: AnyRecord) =>
      typeof item === 'string'
        ? { hash: item, blockNumber: data.number }
        : item,
    );
  }, [data]);

  if (error) return <Layout><Card>{error}</Card></Layout>;
  if (loading || !data) {
    return (
      <Layout>
        <Card>
          <div className="detail-loader">
            <Spinner label="Loading block" />
          </div>
        </Card>
      </Layout>
    );
  }

  const totalExtrinsics = (Array.isArray(data.transactions) ? data.transactions.length : 0)
    + (Array.isArray(data.inherents) ? data.inherents.length : 0);
  const signedExtrinsics = Array.isArray(data.transactions) ? data.transactions.length : 0;

  return (
    <Layout>
      <h1>Blocks</h1>
      <Card title={`Block # ${data.number}`} icon="▧">
        <DetailRows
          data={{
            ...data,
            totalExtrinsics,
            totalSignedExtrinsics: signedExtrinsics,
          }}
          fields={[
            { key: 'timestamp', label: 'Timestamp' },
            { key: 'hash', label: 'Hash' },
            {
              key: 'parentHash',
              label: 'Parent Hash',
              render: (value) =>
                data.number > 0 ? <Link to={`/blocks/${data.number - 1}`}>{value}</Link> : String(value ?? ''),
            },
            { key: 'stateRoot', label: 'State Root' },
            { key: 'extrinsicsRoot', label: 'Extrinsics Root' },
            { key: 'totalExtrinsics', label: 'Total Extrinsics' },
            { key: 'totalSignedExtrinsics', label: 'Total Signed Extrinsics' },
          ]}
        />
      </Card>

      <Card>
        <div className="tabs">
          <button className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>Transaction</button>
          <button className={tab === 'inherents' ? 'active' : ''} onClick={() => setTab('inherents')}>Inherent</button>
          <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>Events</button>
          <button className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}>Logs</button>
        </div>

        {tab === 'transactions' && (
          <Table
            rows={transactions}
            columns={[
              { key: 'hash', label: 'Hash' },
              { key: 'signer', label: 'From' },
              { key: 'method.section', label: 'Module' },
              { key: 'method.method', label: 'Call' },
              { key: 'status', label: 'Status' },
            ]}
            renderCell={(row, key) => {
              if (key === 'hash') {
                return <Link to={`/transactions/${row.blockNumber || data.number}/${row.hash}`}>{short(row.hash, 16)}</Link>;
              }
              if (key === 'signer') return short(row.signer, 22);
              if (key === 'method.section') return row.method?.section || '';
              if (key === 'method.method') return row.method?.method || '';
              if (key === 'status') return <span className="badge success">SUCCESS</span>;
              return String(row[key] ?? '');
            }}
            link={(row) => `/transactions/${row.blockNumber || data.number}/${row.hash}`}
          />
        )}

        {tab === 'inherents' && (
          <Table
            rows={data.inherents || []}
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'method.section', label: 'Module' },
              { key: 'method.method', label: 'Call' },
            ]}
            renderCell={(row, key) => {
              if (key === 'id') return <Link to={`/inherents/${row.id}`}>{row.id}</Link>;
              if (key === 'method.section') return row.method?.section || '';
              if (key === 'method.method') return row.method?.method || '';
              return String(row[key] ?? '');
            }}
            link={(row) => `/inherents/${row.id}`}
          />
        )}

        {tab === 'events' && (
          <Table
            rows={data.events || []}
            columns={[
              { key: 'id', label: 'Event ID' },
              { key: 'meta.name', label: 'Event' },
            ]}
            renderCell={(row, key) => {
              if (key === 'id') return <Link to={`/events/${row.id}`}>{row.id}</Link>;
              if (key === 'meta.name') return row.meta?.name || '';
              return String(row[key] ?? '');
            }}
            link={(row) => `/events/${row.id}`}
          />
        )}

        {tab === 'logs' && (
          <Table
            rows={data.logs || []}
            columns={[
              { key: 'id', label: 'Log ID' },
              { key: 'log', label: 'Type' },
            ]}
            renderCell={(row, key) => {
              if (key === 'id') return <Link to={`/logs/${row.id}`}>{row.id}</Link>;
              if (key === 'log') return Object.keys(row.log || {})[0] || JSON.stringify(row.log);
              return String(row[key] ?? '');
            }}
            link={(row) => `/logs/${row.id}`}
          />
        )}
      </Card>
    </Layout>
  );
}

function AccountDetail() {
  const { signer } = useParams();
  return (
    <ListPage
      title="Accounts"
      endpoint={`/accounts/${signer}/transactions`}
      columns={[
        { key: 'hash', label: 'Hash' },
        { key: 'blockNumber', label: 'Block' },
        { key: 'age', label: 'Age' },
        { key: 'method.section', label: 'Module' },
        { key: 'method.method', label: 'Method' },
      ]}
      renderCell={(row, key) => {
        if (key === 'hash') return <Link to={`/transactions/${row.blockNumber}/${row.hash}`}>{short(row.hash, 16)}</Link>;
        if (key === 'blockNumber') return <Link to={`/blocks/${row.blockNumber}`}>{row.blockNumber}</Link>;
        if (key === 'age') return ageFrom(row.timestamp);
        if (key === 'method.section') return row.method?.section || '';
        if (key === 'method.method') return row.method?.method || '';
        return String(row[key] ?? '');
      }}
      link={(row) => `/transactions/${row.blockNumber}/${row.hash}`}
    />
  );
}

function GenericDetail({
  type,
  endpoint,
  fields,
}: {
  type: string;
  endpoint: string;
  fields: { key: string; label: string; render?: (value: any, data: AnyRecord) => React.ReactNode }[];
}) {
  const params = useParams();
  const id = params['*'] || params.id;
  const [data, setData] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiGet<AnyRecord>(`${endpoint}/${id}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) {
          setData(null);
          setError(`Failed to load ${type.toLowerCase()}`);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [endpoint, id, type]);

  if (error) {
    return (
      <Layout>
        <h1>{type}</h1>
        <Card>{error}</Card>
      </Layout>
    );
  }

  if (loading || !data) {
    return (
      <Layout>
        <h1>{type}</h1>
        <Card>
          <div className="detail-loader">
            <Spinner label={`Loading ${type.toLowerCase()}`} />
          </div>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1>{type}</h1>
      <Card title={`${type} ${id}`}>
        <DetailRows data={data} fields={fields} />
      </Card>
    </Layout>
  );
}

function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [data, setData] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) {
      setData(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    apiGet<AnyRecord>(`/search?q=${encodeURIComponent(q)}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [q]);

  const results = data?.results || [];

  return (
    <Layout>
      <SearchBox initial={q} />
      <Card title={`Search results for ${q || '...'}`}>
        {loading ? (
          <div className="detail-loader">
            <Spinner label="Searching" />
          </div>
        ) : (
          <ul className="results">
            {results.map((item: AnyRecord) => (
              <li key={`${item.type}-${item.url}`}>
                <Link to={item.url}>
                  {item.type}: {item.label}
                </Link>
              </li>
            ))}
            {!q && <li className="muted">Enter a search term.</li>}
            {q && results.length === 0 && <li className="muted">No results found.</li>}
          </ul>
        )}
      </Card>
    </Layout>
  );
}

function PrivacyPage() {
  return (
    <Layout>
      <article className="legal-page">
        <h1>Privacy Policy</h1>
        <p>
          Borlaug Web Services (the &quot;Company&quot;) is committed to maintaining robust privacy protections for its users. Our
          Privacy Policy (&quot;Privacy Policy&quot;) is designed to help you understand how we collect, use and safeguard the
          information you provide to us and to assist you in making informed decisions when using our Service.
        </p>
        <p>
          For purposes of this Agreement, &quot;Site&quot; refers to the Company&apos;s website, which can be accessed at{' '}
          <a href="https://www.borlaug.ws/" target="_blank" rel="noreferrer">
            https://www.borlaug.ws/
          </a>
        </p>
        <p>The terms &quot;we,&quot; &quot;us,&quot; and &quot;our&quot; refer to the Company.</p>
        <p>&quot;You&quot; refers to you, as a user of our Site or our Service.</p>
        <p>
          By accessing our Site or our Service, you accept our Privacy Policy and{' '}
          <Link to="/terms">Terms of Use</Link>, and you consent to our collection, storage, use and disclosure of your
          Personal Information as described in this Privacy Policy.
        </p>

        <h2>I. INFORMATION WE COLLECT</h2>
        <p>
          We collect &quot;Non-Personal Information&quot; and &quot;Personal Information.&quot; Non-Personal Information includes information
          that cannot be used to personally identify you, such as anonymous usage data, general demographic information we
          may collect, referring/exit pages and URLs, platform types, preferences you submit and preferences that are
          generated based on the data you submit and number of clicks. Personal Information includes your email, name,
          gender, date of birth and other personal identification number which you submit to us through the registration
          process at the Site.
        </p>
        <ol>
          <li>
            <strong>Information collected via Technology</strong>
            <p>
              To activate the Service, you do not need to submit any Personal Information other than your email address.
              However, in an effort to improve the quality of the Service, we track information provided to us by your
              browser or by our software application when you view or use the Service, such as the website you came from
              (known as the &quot;referring URL&quot;), the type of browser you use, the device from which you connected to the
              Service, the time and date of access, and other information that does not personally identify you. We track
              this information using cookies, or small text files which include an anonymous unique identifier. Cookies are
              sent to a user&apos;s browser from our servers and are stored on the user&apos;s computer hard drive. Sending a cookie
              to a user&apos;s browser enables us to collect Non-Personal information about that user and keep a record of the
              user&apos;s preferences when utilizing our services, both on an individual and aggregate basis. The Company may use
              both persistent and session cookies; persistent cookies remain on your computer after you close your session
              and until you delete them, while session cookies expire when you close your browser.
            </p>
          </li>
          <li>
            <strong>Information you provide us by registering for an account</strong>
            <p>
              In addition to the information provided automatically by your browser when you visit the Site, to become a
              subscriber to the Service you will need to create a personal profile. You can create a profile by registering
              with the Service and entering your email address, and creating a user name and a password. By registering, you
              are authorizing us to collect, store and use your email address in accordance with this Privacy Policy.
            </p>
          </li>
          <li>
            <strong>Children&apos;s Privacy</strong>
            <p>
              The Site and the Service are not directed to anyone under the age of 13. The Site does not knowingly collect or
              solicit information from anyone under the age of 13, or allow anyone under the age of 13 to sign up for the
              Service. In the event that we learn that we have gathered personal information from anyone under the age of 13
              without the consent of a parent or guardian, we will delete that information as soon as possible. If you
              believe we have collected such information, please contact us at{' '}
              <a href="mailto:info@borlaug.ws">info@borlaug.ws</a>.
            </p>
          </li>
        </ol>

        <h2>II. HOW WE USE AND SHARE INFORMATION</h2>
        <p className="legal-subhead">Personal Information:</p>
        <p>
          Except as otherwise stated in this Privacy Policy, we do not sell, trade, rent or otherwise share for marketing
          purposes your Personal Information with third parties without your consent. Those vendors use your Personal
          Information only at our direction and in accordance with our Privacy Policy.
        </p>
        <p>
          In general, the Personal Information you provide to us is used to help us communicate with you. For example, we
          use Personal Information to contact users in response to questions, solicit feedback from users, provide
          technical support, and inform users about promotional offers.
        </p>
        <p>
          We may share Personal Information with outside parties if we have a good-faith belief that access, use,
          preservation or disclosure of the information is reasonably necessary to meet any applicable legal process or
          enforceable governmental request; to enforce applicable Terms of Service, including investigation of potential
          violations; address fraud, security or technical concerns; or to protect against harm to the rights, property, or
          safety of our users or the public as required or permitted by law.
        </p>
        <p className="legal-subhead">Non-Personal Information:</p>
        <p>
          In general, we use Non-Personal Information to help us improve the Service and customize the user experience. We
          also aggregate Non-Personal Information in order to track trends and analyze use patterns on the Site. This
          Privacy Policy does not limit in any way our use or disclosure of Non-Personal Information and we reserve the
          right to use and disclose such Non-Personal Information to our partners, advertisers and other third parties at
          our discretion.
        </p>
        <p>
          In the event we undergo a business transaction such as a merger, acquisition by another company, or sale of all
          or a portion of our assets, your Personal Information may be among the assets transferred. You acknowledge and
          consent that such transfers may occur and are permitted by this Privacy Policy, and that any acquirer of our
          assets may continue to process your Personal Information as set forth in this Privacy Policy. If our information
          practices change at any time in the future, we will post the policy changes to the Site so that you may opt out
          of the new information practices. We suggest that you check the Site periodically if you are concerned about how
          your information is used.
        </p>

        <h2>III. HOW WE PROTECT INFORMATION</h2>
        <p>
          We implement security measures designed to protect your information from unauthorized access. Your account is
          protected by your account password and we urge you to take steps to keep your personal information safe by not
          disclosing your password and by logging out of your account after each use. We further protect your information
          from potential security breaches by implementing certain technological security measures including encryption,
          firewalls and secure socket layer technology. However, these measures do not guarantee that your information will
          not be accessed, disclosed, altered or destroyed by breach of such firewalls and secure server software. By using
          our Service, you acknowledge that you understand and agree to assume these risks.
        </p>

        <h2>IV. YOUR RIGHTS REGARDING THE USE OF YOUR PERSONAL INFORMATION</h2>
        <p>
          Please note that it is obligatory for the Company to process your Personal Data for the Core Purpose as stated
          above, without which some services or features provided by &quot;The Company&quot; may be affected. If we do not have your
          consent to process your Personal Data for the Ancillary Purposes, we will not be able to keep you updated about
          our future, new and/or enhanced services and products.
        </p>
        <p>Nevertheless, you may stop receiving promotional activities by:</p>
        <ul>
          <li>unsubscribing from the mailing list;</li>
          <li>editing the relevant account settings to unsubscribe; or</li>
          <li>
            sending a request to <a href="mailto:info@borlaug.ws">info@borlaug.ws</a>
          </li>
        </ul>

        <h2>V. LINKS TO OTHER WEBSITES</h2>
        <p>
          As part of the Service, we may provide links to or compatibility with other websites or applications. However, we
          are not responsible for the privacy practices employed by those websites or the information or content they
          contain. This Privacy Policy applies solely to information collected by us through the Site and the Service.
          Therefore, this Privacy Policy does not apply to your use of a third-party website accessed by selecting a link
          on our Site or via our Service. To the extent that you access or use the Service through or on another website or
          application, then the privacy policy of that other website or application will apply to your access or use of
          that site or application. We encourage our users to read the privacy statements of other websites before
          proceeding to use them.
        </p>

        <h2>VI. CHANGES TO OUR PRIVACY POLICY</h2>
        <p>
          The Company reserves the right to change this policy and our Terms of Service at any time. We will notify you of
          significant changes to our Privacy Policy by sending a notice to the primary email address specified in your
          account or by placing a prominent notice on our site. Significant changes will go into effect 30 days following
          such notification. Non-material changes or clarifications will take effect immediately. You should periodically
          check the Site and this privacy page for updates.
        </p>

        <h2>VII. CONTACT US</h2>
        <p>
          If you have any questions regarding this Privacy Policy or the practices of this Site, please contact us by
          sending an email to <a href="mailto:info@borlaug.ws">info@borlaug.ws</a>.
        </p>
        <p className="legal-updated">
          <strong>Last Updated:</strong> This Privacy Policy was last updated on April 3, 2019.
        </p>
      </article>
    </Layout>
  );
}

function TermsPage() {
  return (
    <Layout>
      <article className="legal-page">
        <h1>Terms of Use</h1>
        <p className="legal-effective">Effective as of March 1, 2019</p>
        <p>
          Welcome to the Borlaug&apos;s Terms of Use agreement. For purposes of this agreement, &quot;Site&quot; refers to the
          Company&apos;s website, which can be accessed at{' '}
          <a href="https://www.borlaug.ws/" target="_blank" rel="noreferrer">
            https://www.borlaug.ws/
          </a>
          . &quot;Service&quot; refers to the Company&apos;s services accessed via the Site. The terms &quot;we,&quot; &quot;us,&quot; and &quot;our&quot; refer to the
          Company. &quot;You&quot; refers to you, as a user of our Site or our Service.
        </p>
        <p>
          Please review the following terms carefully. By accessing or using the Service, you signify your agreement to
          these Terms of Use. If you do not agree to be bound by these Terms of Use in their entirety, you may not access
          or use the Service.
        </p>

        <h2>ELIGIBILITY</h2>
        <p>
          You represent and warrant that you: (a) are of legal age to form a binding contract; (b) have not previously been
          suspended or removed from using our Services; and (c) have full power and authority to enter into this agreement
          and in doing so will not violate any other agreement to which you are a party. If you are registering to use the
          Services on behalf of a legal entity, you further represent and warrant that (i) such legal entity is duly
          organized and validly existing under the applicable laws of the jurisdiction of its organization, and (ii) you
          are duly authorized by such legal entity to act on its behalf.
        </p>

        <h2>PRIVACY POLICY</h2>
        <p>
          The Company respects the privacy of its Service users. Please refer to the Company&apos;s{' '}
          <Link to="/privacy">Privacy Policy</Link> which explains how we collect, use, and disclose information that
          pertains to your privacy. When you access or use the Service, you signify your agreement to the Privacy Policy as
          well as these Terms of Use.
        </p>

        <h2>USE RESTRICTIONS</h2>
        <p>Your permission to use the Site is conditioned upon the following use, posting and conduct restrictions:</p>
        <p>You agree that you will not under any circumstances:</p>
        <ul>
          <li>
            access the Service for any reason other than your personal, non-commercial use solely as permitted by the
            normal functionality of the Service,
          </li>
          <li>collect or harvest any personal data of any user of the Site or the Service</li>
          <li>
            use the Site or the Service for the solicitation of business in the course of trade or in connection with a
            commercial enterprise;
          </li>
          <li>
            distribute any part or parts of the Site or the Service without our explicit written permission (we grant the
            operators of public search engines permission to use spiders to copy materials from the site for the sole
            purpose of creating publicly-available searchable indices but retain the right to revoke this permission at any
            time on a general or specific basis);
          </li>
          <li>use the Service for any unlawful purpose or for the promotion of illegal activities;</li>
          <li>attempt to, or harass, abuse or harm another person or group;</li>
          <li>use another user&apos;s account without permission;</li>
          <li>intentionally allow another user to access your account;</li>
          <li>provide false or inaccurate information when registering an account;</li>
          <li>interfere or attempt to interfere with the proper functioning of the Service;</li>
          <li>
            make any automated use of the Site, the Service or the related systems, or take any action that we deem to
            impose or to potentially impose an unreasonable or disproportionately large load on our servers or network
            infrastructure;
          </li>
          <li>
            bypass any robot exclusion headers or other measures we take to restrict access to the Service, or use any
            software, technology, or device to scrape, spider, or crawl the Service or harvest or manipulate data;
          </li>
          <li>
            circumvent, disable or otherwise interfere with any security-related features of the Service or features that
            prevent or restrict use or copying of content, or enforce limitations on use of the Service or the content
            accessible via the Service; or
          </li>
          <li>
            publish or link to malicious content of any sort, including that intended to damage or disrupt another
            user&apos;s browser or computer.
          </li>
        </ul>

        <h2>ACCOUNT REGISTRATION</h2>
        <p>
          You must create an account with Company to access the Services (&quot;Account&quot;). When you create an Account, you agree
          to: (a) create a strong password that you do not use for any other website or online service; (b) provide accurate
          and truthful information; (c) maintain and promptly update your Account information; (d) maintain the security of
          your Account by protecting your Account password and restricting access to your computer and your Account; (e)
          promptly notify us if you discover or otherwise suspect any security breaches related to your Account; and (f)
          take responsibility for all activities that occur under your Account and accept all risks of any authorized or
          unauthorized access to your Account, to the maximum extent permitted by law. When you create an Account, we
          assign you an account identifier that you must retain to access your Account.
        </p>

        <h2>COPYRIGHTS AND OTHER INTELLECTUAL PROPERTY RIGHTS</h2>
        <p>
          Unless otherwise indicated by us, all copyright and other intellectual property rights in all content and other
          materials contained on our website or provided in connection with the Services, including, without limitation, the
          Company or Company logo and all designs, text, graphics, pictures, information, data, software, sound files, other
          files and the selection and arrangement thereof (collectively, &quot;Company Materials&quot;) are the proprietary property of
          Company or our licensors or suppliers and are protected by copyright laws and other intellectual property rights
          laws. We hereby grant you a limited, nonexclusive and non-sublicensable license to access and use the Company
          Materials for your personal or internal business use.
        </p>
        <p>
          Such license is subject to these Terms and does not permit (a) any resale of the Company Materials; (b) the
          distribution, public performance or public display of any Company Materials; (c) modifying or otherwise making any
          derivative uses of the Company Materials, or any portion thereof; or (d) any use of the Company Materials other
          than for their intended purposes. The license granted under this Section will automatically terminate if we
          suspend or terminate your access to the Services.
        </p>

        <h2>TRADEMARKS</h2>
        <p>
          &quot;Borlaug&quot; the product logo, and any other Company product or service names, logos or slogans that may appear on
          our Services are trademarks of Company and may not be copied, imitated or used, in whole or in part, without our
          prior written permission. You will not use any trademark, product or service name of Company without our prior
          written permission, including without limitation any metatags or other &quot;hidden text&quot; utilizing any trademark,
          product or service name of Company. In addition, the look and feel of our Services, including all page headers,
          custom graphics, button icons and scripts, is the service mark, trademark and/or trade dress of Company and may
          not be copied, imitated or used, in whole or in part, without our prior written permission. All other trademarks,
          registered trademarks, product names and company names or logos mentioned through our Services are the property of
          their respective owners. Reference to any products, services, processes or other information, by name, trademark,
          manufacturer, supplier or otherwise does not constitute or imply endorsement, sponsorship or recommendation by us.
        </p>

        <h2>SUSPENSION &amp; TERMINATION</h2>
        <p>
          In the event of any Force Majeure Event, breach of these Terms, or any other event that would make provision of
          the Services commercially unreasonable for Company, we may, in our discretion and without liability to you, with
          or without prior notice, suspend your access to all or a portion of our Services. We may terminate your access to
          the Services in our sole discretion, immediately and without prior notice, and delete or deactivate your Account
          and all related information and files in such account without liability to you, including, for instance, in the
          event that you breach any term of these Terms.
        </p>

        <h2>COOKIE STATEMENT</h2>
        <p>
          This site uses cookies. Cookies are small text files that are placed on your computer by websites that you visit.
          They are widely used in order to make websites work, or work more efficiently, as well as to provide information to
          the owners of the site. Cookies are typically stored on your computer&apos;s hard drive. Information collected from
          cookies is used by us to evaluate the effectiveness of our Site, analyze trends, and manage the platform. The
          information collected from cookies allows us to determine such things as which parts of our Site are most visited
          and difficulties our visitors may experience in accessing our Site. With this knowledge, we can improve the
          quality of your experience on the platform by recognizing and delivering more of the most desired features and
          information, as well as by resolving access difficulties. We also use cookies and/or a technology known as web
          bugs or clear gifs, which are typically stored in emails to help us confirm your receipt of, and response to, our
          emails and to provide you with a more personalized experience when using our Site.
        </p>
        <p>
          We also use third party service provider(s), to assist us in better understanding the use of our Site. Our service
          provider(s) will place cookies on the hard drive of your computer and will receive information that we select that
          will educate us on such things as how visitors navigate around our site, what pages are browsed and general
          transaction information. Our service provider(s) analyses this information and provides us with aggregate reports.
          The information and analysis provided by our service provider(s) will be used to assist us in better understanding
          our visitors&apos; interests in our Site and how to better serve those interests. The information collected by our
          service provider(s) may be linked to and combined with information that we collect about you while you are using
          the platform. Our service provider(s) is/are contractually restricted from using information they receive from our
          Site other than to assist us.
        </p>
        <p>
          Your continued use of this site, as well as any subsequent usage, will be interpreted as your consent to cookies
          being stored on your device.
        </p>

        <h2>EMAIL MAY NOT BE USED TO PROVIDE NOTICE</h2>
        <p>
          Communications made through the Service&apos;s email and messaging system will not constitute legal notice to the Site,
          the Service, or any of its officers, employees, agents or representatives in any situation where legal notice is
          required by contract or any law or regulation.
        </p>

        <h2>USER CONSENT TO RECEIVE COMMUNICATIONS IN ELECTRONIC FORM</h2>
        <p>
          For contractual purposes, you: (a) consent to receive communications from us in an electronic form via the email
          address you have submitted; and (b) agree that all Terms of Use, agreements, notices, disclosures, and other
          communications that we provide to you electronically satisfy any legal requirement that such communications would
          satisfy if it were in writing. The foregoing does not affect your non-waivable rights.
        </p>
        <p>Opting out may prevent you from receiving messages regarding the Site, the Service or special offers.</p>

        <h2>WARRANTY DISCLAIMER</h2>
        <p>
          THE SERVICE, IS PROVIDED &quot;AS IS,&quot; WITHOUT WARRANTY OF ANY KIND. WITHOUT LIMITING THE FOREGOING, WE EXPRESSLY
          DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED OR STATUTORY, REGARDING THE SERVICE INCLUDING WITHOUT LIMITATION
          ANY WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, SECURITY, ACCURACY AND NON-INFRINGEMENT.
          WITHOUT LIMITING THE FOREGOING, WE MAKE NO WARRANTY OR REPRESENTATION THAT ACCESS TO OR OPERATION OF THE SERVICE
          WILL BE UNINTERRUPTED OR ERROR FREE. YOU ASSUME FULL RESPONSIBILITY AND RISK OF LOSS RESULTING FROM YOUR
          DOWNLOADING AND/OR USE OF FILES, INFORMATION, CONTENT OR OTHER MATERIAL OBTAINED FROM THE SERVICE. SOME
          JURISDICTIONS LIMIT OR DO NOT PERMIT DISCLAIMERS OF WARRANTY, SO THIS PROVISION MAY NOT APPLY TO YOU.
        </p>

        <h2>LIMITATION OF DAMAGES; RELEASE</h2>
        <p>
          TO THE EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE SITE, THE SERVICE, ITS AFFILIATES, DIRECTORS, OR
          EMPLOYEES, OR ITS LICENSORS OR PARTNERS, BE LIABLE TO YOU FOR ANY LOSS OF PROFITS, USE, OR DATA, OR FOR ANY
          INCIDENTAL, INDIRECT, SPECIAL, CONSEQUENTIAL OR EXEMPLARY DAMAGES, HOWEVER ARISING, THAT RESULT FROM: (A) THE USE,
          DISCLOSURE, OR DISPLAY OF YOUR USER CONTENT; (B) YOUR USE OR INABILITY TO USE THE SERVICE; (C) THE SERVICE
          GENERALLY OR THE SOFTWARE OR SYSTEMS THAT MAKE THE SERVICE AVAILABLE; OR (D) ANY OTHER INTERACTIONS WITH USE OR
          WITH ANY OTHER USER OF THE SERVICE, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE) OR ANY OTHER
          LEGAL THEORY, AND WHETHER OR NOT WE HAVE BEEN INFORMED OF THE POSSIBILITY OF SUCH DAMAGE, AND EVEN IF A REMEDY SET
          FORTH HEREIN IS FOUND TO HAVE FAILED OF ITS ESSENTIAL PURPOSE. SOME JURISDICTIONS LIMIT OR DO NOT PERMIT
          DISCLAIMERS OF LIABILITY, SO THIS PROVISION MAY NOT APPLY TO YOU.
        </p>

        <h2>MODIFICATION OF TERMS OF USE</h2>
        <p>
          We can amend these Terms of Use at any time and will update these Terms of Use in the event of any such
          amendments. It is your sole responsibility to check the Site from time to time to view any such changes in this
          agreement. Your continued use of the Site or the Service signifies your agreement to our revisions to these Terms
          of Use. We will endeavor to notify you of material changes to the Terms by posting a notice on our homepage and/or
          sending an email to the email address you provided to us upon registration. For this additional reason, you should
          keep your contact and profile information current. Any changes to these Terms (other than as set forth in this
          paragraph) or waiver of our rights hereunder shall not be valid or effective except in a written agreement bearing
          the physical signature of one of our officers. No purported waiver or modification of this agreement on our part
          via telephonic or email communications shall be valid.
        </p>

        <h2>MISCELLANEOUS</h2>
        <p>
          <strong>Entire Agreement; Order of Precedence</strong> - These Terms contain the entire agreement, and supersede
          all prior and contemporaneous understandings between the parties regarding the Services. These Terms do not alter
          the terms or conditions of any other electronic or written agreement you may have with Company for the Services or
          for any other Company product or service or otherwise. In the event of any conflict between these Terms and any
          other agreement you may have with Company, the terms of that other agreement will control only if these Terms are
          specifically identified and declared to be overridden by such other agreement.
        </p>
        <p>
          <strong>Amendment</strong> - We reserve the right to make changes or modifications to these Terms from time to
          time, in our sole discretion. Amended Terms will become effective immediately on the date they are posted to the
          Services unless we state otherwise via our notice of such amended Terms. Any amended Terms will apply
          prospectively to use of the Services after such changes become effective. Your continued use of the Services
          following the effective date of such changes will constitute your acceptance of such changes. If you do not agree
          to any amended Terms, you must discontinue using the Services.
        </p>
        <p>
          <strong>Waiver</strong> - Our failure or delay in exercising any right, power or privilege under these Terms will
          not operate as a waiver thereof.
        </p>
        <p>
          <strong>Severability</strong> - The invalidity or unenforceability of any of these Terms will not affect the
          validity or enforceability of any other of these Terms, all of which will remain in full force and effect.
        </p>
        <p>
          <strong>Force Majeure Events</strong> - Company will not be liable for any loss or damage arising from any event
          beyond Company&apos;s reasonable control, including, but not limited to, flood, extraordinary weather conditions,
          earthquake, or other act of God, fire, war, insurrection, riot, labor dispute, accident, action of government,
          communications, power failure, or equipment or software malfunction (each, a &quot;Force Majeure Event&quot;).
        </p>
        <p>
          <strong>Assignment</strong> - You may not assign or transfer any of your rights or obligations under these Terms
          without prior written consent from Company, including by operation of law or in connection with any change of
          control. Company may assign or transfer any or all of its rights under these Terms, in whole or in part, without
          obtaining your consent or approval.
        </p>
        <p className="legal-ack">
          YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF USE, UNDERSTAND THE TERMS OF USE, AND WILL BE BOUND BY THESE
          TERMS AND CONDITIONS. YOU FURTHER ACKNOWLEDGE THAT THESE TERMS OF USE TOGETHER WITH THE PRIVACY POLICY REPRESENT
          THE COMPLETE AND EXCLUSIVE STATEMENT OF THE AGREEMENT BETWEEN US AND THAT IT SUPERSEDES ANY PROPOSAL OR PRIOR
          AGREEMENT ORAL OR WRITTEN, AND ANY OTHER COMMUNICATIONS BETWEEN US RELATING TO THE SUBJECT MATTER OF THIS
          AGREEMENT.
        </p>
      </article>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/transactions/:blockNumber/:hash" element={<TransactionDetail />} />
        <Route path="/blocks" element={<Blocks />} />
        <Route path="/blocks/:number" element={<BlockDetail />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:signer" element={<AccountDetail />} />
        <Route
          path="/events/:id"
          element={
            <GenericDetail
              type="Events"
              endpoint="/events"
              fields={[
                {
                  key: 'blockNumber',
                  label: 'Block',
                  render: (value) => <Link to={`/blocks/${value}`}>{value}</Link>,
                },
                { key: 'extrinsicid', label: 'Referenced Extrinsic' },
                { key: 'index', label: 'Event Index' },
                { key: 'meta.name', label: 'Event Name' },
                {
                  key: 'meta.documentation',
                  label: 'Description',
                  render: (value) => (Array.isArray(value) ? value.join(' ') : String(value ?? '')),
                },
                { key: 'event', label: 'Parameters' },
                { key: 'timestamp', label: 'Timestamp' },
              ]}
            />
          }
        />
        <Route
          path="/inherents/:id"
          element={
            <GenericDetail
              type="Inherents"
              endpoint="/inherents"
              fields={[
                {
                  key: 'blockNumber',
                  label: 'Block',
                  render: (value) => <Link to={`/blocks/${value}`}>{value}</Link>,
                },
                { key: 'index', label: 'Extrinsic Index' },
                { key: 'method.section', label: 'Module' },
                { key: 'method.method', label: 'Call' },
                {
                  key: 'method.documentation',
                  label: 'Description',
                  render: (value) => (Array.isArray(value) ? value.join(' ') : String(value ?? '')),
                },
                { key: 'method.args', label: 'Parameters' },
                { key: 'timestamp', label: 'Timestamp' },
              ]}
            />
          }
        />
        <Route
          path="/logs/:id"
          element={
            <GenericDetail
              type="Logs"
              endpoint="/logs"
              fields={[
                {
                  key: 'blockNumber',
                  label: 'Block',
                  render: (value) => <Link to={`/blocks/${value}`}>{value}</Link>,
                },
                { key: 'index', label: 'Log Index' },
                { key: 'log', label: 'Type / Data' },
                { key: 'timestamp', label: 'Timestamp' },
              ]}
            />
          }
        />
        <Route
          path="/identities/*"
          element={
            <GenericDetail
              type="Identifier"
              endpoint="/identities"
              fields={[
                { key: 'did', label: 'DID' },
                {
                  key: 'blockNumber',
                  label: 'Block Number',
                  render: (value) => <Link to={`/blocks/${value}`}>{value}</Link>,
                },
                { key: 'blockHash', label: 'Block Hash' },
                { key: 'extrinsicHash', label: 'Transaction Hash' },
                { key: 'subject', label: 'Subject' },
                { key: 'controller', label: 'Controller' },
                { key: 'properties', label: 'Properties' },
                { key: 'claims', label: 'Claims' },
              ]}
            />
          }
        />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    </Router>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
