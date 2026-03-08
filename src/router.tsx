import { createBrowserRouter } from 'react-router';
import RootLayout from './layouts/RootLayout';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Nodes from './pages/Nodes';
import Schedules from './pages/Schedules';
import DLQ from './pages/DLQ';
import Runs from './pages/Runs';
import Settings from './pages/Settings';
import Workflows from './pages/Workflows';
import WorkflowDetail from './pages/WorkflowDetail';
import Batches from './pages/Batches';
import BatchDetail from './pages/BatchDetail';
import Queues from './pages/Queues';
import RedisInfo from './pages/RedisInfo';
import Search from './pages/Search';
import AuditTrail from './pages/AuditTrail';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'jobs', element: <Jobs /> },
      { path: 'jobs/:id', element: <JobDetail /> },
      { path: 'runs', element: <Runs /> },
      { path: 'nodes', element: <Nodes /> },
      { path: 'schedules', element: <Schedules /> },
      { path: 'queues', element: <Queues /> },
      { path: 'dlq', element: <DLQ /> },
      { path: 'workflows', element: <Workflows /> },
      { path: 'workflows/:id', element: <WorkflowDetail /> },
      { path: 'batches', element: <Batches /> },
      { path: 'batches/:id', element: <BatchDetail /> },
      { path: 'audit', element: <AuditTrail /> },
      { path: 'search', element: <Search /> },
      { path: 'redis', element: <RedisInfo /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);
