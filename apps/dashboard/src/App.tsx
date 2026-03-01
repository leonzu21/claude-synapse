import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SynapseCanvas from './components/synapse/SynapseCanvas';
import TimelineWaterfall from './components/synapse/TimelineWaterfall';
import ActivityFeed from './components/sidebar/ActivityFeed';
import AgentDetail from './components/sidebar/AgentDetail';
import SessionPicker from './components/controls/SessionPicker';
import ConnectionStatus from './components/controls/ConnectionStatus';
import SimulateButton from './components/controls/SimulateButton';
import SessionInfo from './components/controls/SessionInfo';
import ToastContainer from './components/toast/ToastContainer';
import { headerLabels } from './labels/modeLabels';

import { useSocket } from './hooks/useSocket';

export default function App() {
  useSocket();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'timeline'>('graph');

  return (
    <div className="h-screen flex flex-col synapse-mode" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header bar */}
      <header
        className="min-h-[40px] flex items-center gap-2 px-3 py-1 border-b-2 flex-shrink-0 flex-wrap"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}
      >
        <span
          className="text-[13px] font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0"
          style={{ color: 'var(--text-primary)' }}
        >
          {headerLabels.title}
        </span>
        <SessionPicker />
        <ConnectionStatus />

        <SimulateButton />

        {/* View mode tabs */}
        <div className="flex flex-shrink-0">
          <button
            className="text-[12px] font-bold uppercase px-1.5 py-0.5 border"
            style={{
              color: viewMode === 'graph' ? '#7c3aed' : 'var(--text-muted)',
              borderColor: '#334155',
              backgroundColor: viewMode === 'graph' ? '#1e1b4b' : 'transparent',
            }}
            onClick={() => setViewMode('graph')}
          >
            GRAPH
          </button>
          <button
            className="text-[12px] font-bold uppercase px-1.5 py-0.5 border border-l-0"
            style={{
              color: viewMode === 'timeline' ? '#7c3aed' : 'var(--text-muted)',
              borderColor: '#334155',
              backgroundColor: viewMode === 'timeline' ? '#1e1b4b' : 'transparent',
            }}
            onClick={() => setViewMode('timeline')}
          >
            TIMELINE
          </button>
        </div>

        {/* Spacer pushes sidebar toggle to the right when there's room */}
        <div className="flex-1 min-w-0" />

        <button
          className="text-[13px] font-bold uppercase px-2 py-0.5 border-2 active:translate-y-px flex-shrink-0"
          style={{
            color: 'var(--text-dim)',
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg-card)',
          }}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? headerLabels.sidebarOpen : headerLabels.sidebarClosed}
        </button>
      </header>

      {/* Session info bar */}
      <div className="border-b-2 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <SessionInfo />
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph canvas */}
        <main className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {viewMode === 'timeline' ? <TimelineWaterfall /> : <SynapseCanvas />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Sidebar - collapsible */}
        {sidebarOpen && (
          <aside
            className="w-80 border-l-2 flex flex-col flex-shrink-0"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="flex-1 overflow-hidden">
              <ActivityFeed />
            </div>
            <AgentDetail />
          </aside>
        )}
      </div>

      <ToastContainer />
    </div>
  );
}
