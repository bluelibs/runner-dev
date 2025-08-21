import React, { useState } from 'react';
import { Middleware } from '../../../schema/model';
import { Introspector } from '../../../resources/introspector.resource';
import { formatSchema, formatFilePath, formatArray, formatId } from '../utils/formatting';

export interface MiddlewareCardProps {
  middleware: Middleware;
  introspector: Introspector;
}

export const MiddlewareCard: React.FC<MiddlewareCardProps> = ({ middleware, introspector }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'usage'>('overview');

  const taskUsages = introspector.getTasksUsingMiddlewareDetailed(middleware.id);
  const resourceUsages = introspector.getResourcesUsingMiddlewareDetailed(middleware.id);
  const emittedEvents = introspector.getMiddlewareEmittedEvents(middleware.id);

  const cardStyle = {
    background: '#fff',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    overflow: 'hidden' as const,
    transition: 'box-shadow 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #6f42c1, #5a2b99)',
    color: 'white',
    padding: '20px',
    cursor: 'pointer'
  };

  const contentStyle = {
    padding: '20px'
  };

  const getMiddlewareTypeIcon = () => {
    if (middleware.global?.enabled) return '🌐';
    if (middleware.usedByTasks.length > 0 && middleware.usedByResources.length > 0) return '🔗';
    if (middleware.usedByTasks.length > 0) return '⚙️';
    if (middleware.usedByResources.length > 0) return '🔧';
    return '🔗';
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>{getMiddlewareTypeIcon()}</span>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                {middleware.meta?.title || formatId(middleware.id)}
              </h3>
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9, fontFamily: 'monospace' }}>
              {middleware.id}
            </div>
            {middleware.meta?.description && (
              <p style={{ margin: '10px 0 0 0', fontSize: '14px', opacity: 0.95, lineHeight: '1.4' }}>
                {middleware.meta.description}
              </p>
            )}
            
            {middleware.global?.enabled && (
              <div style={{ 
                marginTop: '10px',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  background: 'rgba(255,255,255,0.25)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  🌐 Global
                </span>
                {middleware.global.tasks && (
                  <span style={{
                    background: 'rgba(255,255,255,0.25)',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    Tasks
                  </span>
                )}
                {middleware.global.resources && (
                  <span style={{
                    background: 'rgba(255,255,255,0.25)',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    Resources
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {middleware.meta?.tags && middleware.meta.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {middleware.meta.tags.slice(0, 3).map(tag => (
                  <span key={tag} style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {tag}
                  </span>
                ))}
                {middleware.meta.tags.length > 3 && (
                  <span style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    +{middleware.meta.tags.length - 3}
                  </span>
                )}
              </div>
            )}
            <span style={{ fontSize: '18px' }}>
              {expanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={contentStyle}>
          <div style={{ 
            display: 'flex', 
            borderBottom: '1px solid #e9ecef', 
            marginBottom: '20px',
            gap: '0'
          }}>
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'config', label: 'Config Schema' },
              { id: 'usage', label: 'Usage' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: activeTab === tab.id ? '#6f42c1' : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#6c757d',
                  cursor: 'pointer',
                  borderRadius: '4px 4px 0 0',
                  fontWeight: activeTab === tab.id ? '600' : '400',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <strong style={{ color: '#495057' }}>File Path:</strong>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                  {formatFilePath(middleware.filePath)}
                </div>
              </div>

              {middleware.registeredBy && (
                <div>
                  <strong style={{ color: '#495057' }}>Registered By:</strong>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                    {middleware.registeredBy}
                  </div>
                </div>
              )}

              <div>
                <strong style={{ color: '#495057' }}>Usage Summary:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '8px' }}>
                  <div style={{ 
                    background: '#f8f9fa', 
                    padding: '8px 12px', 
                    borderRadius: '4px',
                    textAlign: 'center',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#007acc' }}>{taskUsages.length}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>Tasks</div>
                  </div>
                  <div style={{ 
                    background: '#f8f9fa', 
                    padding: '8px 12px', 
                    borderRadius: '4px',
                    textAlign: 'center',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#28a745' }}>{resourceUsages.length}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>Resources</div>
                  </div>
                  <div style={{ 
                    background: '#f8f9fa', 
                    padding: '8px 12px', 
                    borderRadius: '4px',
                    textAlign: 'center',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#ffc107' }}>{emittedEvents.length}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>Events</div>
                  </div>
                </div>
              </div>

              {middleware.global?.enabled && (
                <div style={{ 
                  background: '#e8f4fd', 
                  border: '1px solid #bee5eb', 
                  padding: '12px', 
                  borderRadius: '4px' 
                }}>
                  <strong style={{ color: '#0c5460' }}>🌐 Global Middleware Configuration</strong>
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#0c5460' }}>
                    <div><strong>Tasks:</strong> {middleware.global.tasks ? 'Enabled' : 'Disabled'}</div>
                    <div><strong>Resources:</strong> {middleware.global.resources ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
              )}

              {middleware.overriddenBy && (
                <div style={{ 
                  background: '#fff3cd', 
                  border: '1px solid #ffeaa7', 
                  padding: '10px', 
                  borderRadius: '4px' 
                }}>
                  <strong style={{ color: '#856404' }}>⚠️ Overridden By:</strong>
                  <div style={{ fontSize: '13px', color: '#856404', marginTop: '4px', fontFamily: 'monospace' }}>
                    {middleware.overriddenBy}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div>
              <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>Configuration Schema</h4>
              <pre style={{
                background: '#f8f9fa',
                padding: '15px',
                borderRadius: '4px',
                fontSize: '12px',
                lineHeight: '1.4',
                overflow: 'auto',
                border: '1px solid #e9ecef',
                margin: 0
              }}>
                {formatSchema(middleware.configSchema)}
              </pre>
            </div>
          )}

          {activeTab === 'usage' && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {taskUsages.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Used by Tasks</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {taskUsages.map(usage => (
                      <div key={usage.id} style={{
                        padding: '12px',
                        background: '#e3f2fd',
                        borderRadius: '4px',
                        borderLeft: '4px solid #2196f3'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '500' }}>
                              {usage.node.meta?.title || formatId(usage.id)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace', marginTop: '4px' }}>
                              {usage.id}
                            </div>
                          </div>
                          {usage.config && (
                            <span style={{
                              background: '#bbdefb',
                              color: '#1565c0',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '500'
                            }}>
                              Configured
                            </span>
                          )}
                        </div>
                        {usage.config && (
                          <details style={{ marginTop: '8px' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#1565c0' }}>
                              View Configuration
                            </summary>
                            <pre style={{
                              background: '#fff',
                              padding: '8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              margin: '8px 0 0 0',
                              border: '1px solid #dee2e6',
                              overflow: 'auto'
                            }}>
                              {usage.config}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resourceUsages.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Used by Resources</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {resourceUsages.map(usage => (
                      <div key={usage.id} style={{
                        padding: '12px',
                        background: '#e8f5e8',
                        borderRadius: '4px',
                        borderLeft: '4px solid #4caf50'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '500' }}>
                              {usage.node.meta?.title || formatId(usage.id)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace', marginTop: '4px' }}>
                              {usage.id}
                            </div>
                          </div>
                          {usage.config && (
                            <span style={{
                              background: '#c8e6c9',
                              color: '#2e7d32',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '500'
                            }}>
                              Configured
                            </span>
                          )}
                        </div>
                        {usage.config && (
                          <details style={{ marginTop: '8px' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#2e7d32' }}>
                              View Configuration
                            </summary>
                            <pre style={{
                              background: '#fff',
                              padding: '8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              margin: '8px 0 0 0',
                              border: '1px solid #dee2e6',
                              overflow: 'auto'
                            }}>
                              {usage.config}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {emittedEvents.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Events Emitted by Usage</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {emittedEvents.map(event => (
                      <div key={event.id} style={{
                        padding: '8px 12px',
                        background: '#fff3e0',
                        borderRadius: '4px',
                        borderLeft: '4px solid #ff9800'
                      }}>
                        <div style={{ fontWeight: '500' }}>{event.meta?.title || formatId(event.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{event.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {taskUsages.length === 0 && resourceUsages.length === 0 && (
                <div style={{ 
                  color: '#6c757d', 
                  fontStyle: 'italic', 
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  This middleware is not currently used by any tasks or resources.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};