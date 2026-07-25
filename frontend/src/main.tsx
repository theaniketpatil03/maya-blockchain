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

function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner" role="status" aria-live="polite" aria-label={label}>
      <span className="spinner-ring" aria-hidden="true" />
      <span className="spinner-text">{label}…</span>
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
          {loading && <div className="muted">Searching...</div>}
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
  useEffect(() => {
    apiGet<AnyRecord>('/stats/latest').then(setData).catch(() => setData(null));
  }, []);

  const latestBlockTime = data?.latestBlocks?.[0]?.timestamp;
  const latestTxTime = data?.latestTransactions?.[0]?.timestamp;

  return (
    <Layout>
      <SearchBox />
      <div className="grid two">
        <Card title="Latest Blocks" icon="▧">
          <Table
            rows={data?.latestBlocks || []}
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
          <div className="card-meta">Last Synced Block Time: {formatTime(latestBlockTime)}</div>
          <Link className="btn btn-block" to="/blocks">
            View All Blocks
          </Link>
        </Card>

        <Card title="Latest Transactions" icon="▰">
          <Table
            rows={data?.latestTransactions || []}
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
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    apiGet<AnyRecord>(`/transactions/${blockNumber}/${hash}`)
      .then(setData)
      .catch(() => setError('Failed to load transaction'));
  }, [blockNumber, hash]);

  if (error) return <Layout><Card>{error}</Card></Layout>;
  if (!data) return <Layout><Card>Loading...</Card></Layout>;

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
  const [tab, setTab] = useState<'transactions' | 'inherents' | 'events' | 'logs'>('transactions');

  useEffect(() => {
    apiGet<AnyRecord>(`/blocks/${number}`).then(setData);
  }, [number]);

  const transactions = useMemo(() => {
    if (!data?.transactions) return [];
    return data.transactions.map((item: AnyRecord) =>
      typeof item === 'string'
        ? { hash: item, blockNumber: data.number }
        : item,
    );
  }, [data]);

  if (!data) return <Layout><Card>Loading...</Card></Layout>;

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
  useEffect(() => {
    apiGet<AnyRecord>(`${endpoint}/${id}`).then(setData);
  }, [endpoint, id]);
  if (!data) return <Layout><Card>Loading...</Card></Layout>;
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
  useEffect(() => {
    if (q) apiGet<AnyRecord>(`/search?q=${encodeURIComponent(q)}`).then(setData);
  }, [q]);

  return (
    <Layout>
      <SearchBox initial={q} />
      <Card title={`Search results for ${q || '...'}`}>
        <ul className="results">
          {(data?.results || []).map((item: AnyRecord) => (
            <li key={`${item.type}-${item.url}`}>
              <Link to={item.url}>
                {item.type}: {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </Layout>
  );
}

function StaticPage({ title }: { title: string }) {
  return (
    <Layout>
      <Card title={title}>
        <p>This page is static content for the explorer deployment.</p>
      </Card>
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
        <Route path="/privacy" element={<StaticPage title="Privacy" />} />
        <Route path="/terms" element={<StaticPage title="Terms" />} />
      </Routes>
    </Router>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
