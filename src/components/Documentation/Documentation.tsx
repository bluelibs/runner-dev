import React, { useState } from 'react';
import { Introspector } from '../../resources/introspector.resource';
import { Sidebar } from './components/Sidebar';
import { TaskCard } from './components/TaskCard';
import { ResourceCard } from './components/ResourceCard';
import { MiddlewareCard } from './components/MiddlewareCard';
import { EventCard } from './components/EventCard';
import { HookCard } from './components/HookCard';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';

export interface DocumentationProps {
  introspector: Introspector;
}

export type Section = 'overview' | 'tasks' | 'resources' | 'hooks' | 'events' | 'middlewares' | 'tags' | 'diagnostics';

export const Documentation: React.FC<DocumentationProps> = ({ introspector }) => {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div style={{ padding: '20px' }}>
            <h1>Runner Application Documentation</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
              <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Tasks</h3>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007acc' }}>{introspector.getTasks().length}</div>
              </div>
              <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Resources</h3>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>{introspector.getResources().length}</div>
              </div>
              <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Events</h3>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>{introspector.getEvents().length}</div>
              </div>
              <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Middlewares</h3>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>{introspector.getMiddlewares().length}</div>
              </div>
            </div>
            <div style={{ marginTop: '30px' }}>
              <h3>Diagnostics Summary</h3>
              <DiagnosticsPanel introspector={introspector} />
            </div>
          </div>
        );
      
      case 'tasks':
        const tasks = introspector.getTasks().filter(task => 
          searchQuery === '' || task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.meta?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (selectedTag === null || task.meta?.tags?.includes(selectedTag))
        );
        return (
          <div style={{ padding: '20px' }}>
            <h2>Tasks ({tasks.length})</h2>
            <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} introspector={introspector} />
              ))}
            </div>
          </div>
        );
      
      case 'resources':
        const resources = introspector.getResources().filter(resource => 
          searchQuery === '' || resource.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          resource.meta?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (selectedTag === null || resource.meta?.tags?.includes(selectedTag))
        );
        return (
          <div style={{ padding: '20px' }}>
            <h2>Resources ({resources.length})</h2>
            <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
              {resources.map(resource => (
                <ResourceCard key={resource.id} resource={resource} introspector={introspector} />
              ))}
            </div>
          </div>
        );
      
      case 'events':
        const events = introspector.getEvents().filter(event => 
          searchQuery === '' || event.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.meta?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (selectedTag === null || event.meta?.tags?.includes(selectedTag))
        );
        return (
          <div style={{ padding: '20px' }}>
            <h2>Events ({events.length})</h2>
            <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
              {events.map(event => (
                <EventCard key={event.id} event={event} introspector={introspector} />
              ))}
            </div>
          </div>
        );
      
      case 'hooks':
        const hooks = introspector.getHooks().filter(hook => 
          searchQuery === '' || hook.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          hook.meta?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (selectedTag === null || hook.meta?.tags?.includes(selectedTag))
        );
        return (
          <div style={{ padding: '20px' }}>
            <h2>Hooks ({hooks.length})</h2>
            <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
              {hooks.map(hook => (
                <HookCard key={hook.id} hook={hook} introspector={introspector} />
              ))}
            </div>
          </div>
        );
      
      case 'middlewares':
        const middlewares = introspector.getMiddlewares().filter(middleware => 
          searchQuery === '' || middleware.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          middleware.meta?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (selectedTag === null || middleware.meta?.tags?.includes(selectedTag))
        );
        return (
          <div style={{ padding: '20px' }}>
            <h2>Middlewares ({middlewares.length})</h2>
            <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
              {middlewares.map(middleware => (
                <MiddlewareCard key={middleware.id} middleware={middleware} introspector={introspector} />
              ))}
            </div>
          </div>
        );
      
      case 'tags':
        const tags = introspector.getAllTags();
        return (
          <div style={{ padding: '20px' }}>
            <h2>Tags ({tags.length})</h2>
            <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
              {tags.map(tag => (
                <div key={tag.id} style={{
                  background: '#fff',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  padding: '20px'
                }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>{tag.id}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                    <div><strong>Tasks:</strong> {tag.tasks.length}</div>
                    <div><strong>Resources:</strong> {tag.resources.length}</div>
                    <div><strong>Events:</strong> {tag.events.length}</div>
                    <div><strong>Middlewares:</strong> {tag.middlewares.length}</div>
                    <div><strong>Hooks:</strong> {tag.hooks.length}</div>
                  </div>
                  <button
                    style={{
                      marginTop: '15px',
                      padding: '8px 16px',
                      border: '1px solid #007acc',
                      background: selectedTag === tag.id ? '#007acc' : 'transparent',
                      color: selectedTag === tag.id ? 'white' : '#007acc',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                  >
                    {selectedTag === tag.id ? 'Clear Filter' : 'Filter by Tag'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'diagnostics':
        return (
          <div style={{ padding: '20px' }}>
            <h2>Diagnostics</h2>
            <DiagnosticsPanel introspector={introspector} detailed />
          </div>
        );
      
      default:
        return <div>Section not found</div>;
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      fontFamily: 'Arial, sans-serif',
      background: '#f8f9fa'
    }}>
      <Sidebar 
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        introspector={introspector}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTag={selectedTag}
        onTagChange={setSelectedTag}
      />
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        background: '#fff',
        marginLeft: '300px'
      }}>
        {renderContent()}
      </div>
    </div>
  );
};