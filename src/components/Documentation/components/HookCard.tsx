import React, { useState } from 'react';
import { Hook } from '../../../schema/model';
import { Introspector } from '../../../resources/introspector.resource';
import { formatFilePath, formatArray, formatId } from '../utils/formatting';

export interface HookCardProps {
  hook: Hook;
  introspector: Introspector;
}

export const HookCard: React.FC<HookCardProps> = ({ hook, introspector }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'dependencies' | 'event'>('overview');

  const dependencies = introspector.getDependencies(hook);
  const emittedEvents = introspector.getEmittedEvents(hook);
  const targetEvent = introspector.getEvent(hook.event);

  const cardStyle = {
    background: '#fff',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    overflow: 'hidden' as const,
    transition: 'box-shadow 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #9c27b0, #673ab7)',
    color: 'white',
    padding: '20px',
    cursor: 'pointer'
  };

  const contentStyle = {
    padding: '20px'
  };

  const getHookOrderDisplay = () => {
    if (hook.hookOrder === null || hook.hookOrder === undefined) return 'Default';
    return hook.hookOrder.toString();
  };

  const getHookStatus = () => {
    if (!targetEvent) return { text: 'Invalid Event', color: '#dc3545', icon: '❌' };
    if (dependencies.tasks.length === 0 && dependencies.resources.length === 0) {
      return { text: 'No Dependencies', color: '#6c757d', icon: '🔗' };
    }
    return { text: 'Active', color: '#28a745', icon: '✅' };
  };

  const status = getHookStatus();

  return (
    <div style={cardStyle}>
      <div style={headerStyle} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>🪝</span>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                {hook.meta?.title || formatId(hook.id)}
              </h3>
              <span style={{
                background: 'rgba(255,255,255,0.25)',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '500'
              }}>
                {status.text}
              </span>
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9, fontFamily: 'monospace' }}>
              {hook.id}
            </div>
            {hook.meta?.description && (
              <p style={{ margin: '10px 0 0 0', fontSize: '14px', opacity: 0.95, lineHeight: '1.4' }}>
                {hook.meta.description}
              </p>
            )}
            <div style={{ 
              marginTop: '8px',
              display: 'flex',
              gap: '12px',
              fontSize: '13px',
              opacity: 0.9
            }}>
              <div>
                <strong>Listens to:</strong> {formatId(hook.event)}
              </div>
              <div>
                <strong>Order:</strong> {getHookOrderDisplay()}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {hook.hookOrder !== null && hook.hookOrder !== undefined && (
                <div style={{ 
                  background: 'rgba(255,255,255,0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  #{hook.hookOrder}
                </div>
              )}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 8px',
                borderRadius: '12px'
              }}>
                <span style={{ fontSize: '12px' }}>📤</span>
                <span style={{ fontSize: '12px', fontWeight: '500' }}>{emittedEvents.length}</span>
              </div>
            </div>
            {hook.meta?.tags && hook.meta.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {hook.meta.tags.slice(0, 2).map(tag => (
                  <span key={tag} style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {tag}
                  </span>
                ))}
                {hook.meta.tags.length > 2 && (
                  <span style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    +{hook.meta.tags.length - 2}
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
              { id: 'event', label: 'Target Event' },
              { id: 'dependencies', label: 'Dependencies' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: activeTab === tab.id ? '#9c27b0' : 'transparent',
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
                  {formatFilePath(hook.filePath)}
                </div>
              </div>

              {hook.registeredBy && (
                <div>
                  <strong style={{ color: '#495057' }}>Registered By:</strong>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                    {hook.registeredBy}
                  </div>
                </div>
              )}

              <div>
                <strong style={{ color: '#495057' }}>Hook Configuration:</strong>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '10px', 
                  marginTop: '8px' 
                }}>
                  <div style={{ 
                    background: '#f8f9fa', 
                    padding: '12px', 
                    borderRadius: '4px',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                      <strong>Target Event</strong>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', wordBreak: 'break-word' }}>
                      {formatId(hook.event)}
                    </div>
                    {targetEvent && targetEvent.meta?.title && (
                      <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px', fontStyle: 'italic' }}>
                        {targetEvent.meta.title}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ 
                    background: '#f8f9fa', 
                    padding: '12px', 
                    borderRadius: '4px',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                      <strong>Execution Order</strong>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#9c27b0' }}>
                      {getHookOrderDisplay()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>
                      {hook.hookOrder === null || hook.hookOrder === undefined 
                        ? 'Uses default ordering'
                        : `Priority level ${hook.hookOrder}`
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <strong style={{ color: '#495057' }}>Event Flow:</strong>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '10px', 
                  marginTop: '8px' 
                }}>
                  <div style={{ 
                    background: dependencies.tasks.length + dependencies.resources.length > 0 ? '#d4edda' : '#f8d7da', 
                    padding: '8px 12px', 
                    borderRadius: '4px',
                    textAlign: 'center',
                    border: `1px solid ${dependencies.tasks.length + dependencies.resources.length > 0 ? '#c3e6cb' : '#f5c6cb'}`
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      color: dependencies.tasks.length + dependencies.resources.length > 0 ? '#155724' : '#721c24' 
                    }}>
                      {dependencies.tasks.length + dependencies.resources.length}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: dependencies.tasks.length + dependencies.resources.length > 0 ? '#155724' : '#721c24' 
                    }}>
                      Dependencies
                    </div>
                  </div>
                  <div style={{ 
                    background: emittedEvents.length > 0 ? '#d4edda' : '#fff3cd', 
                    padding: '8px 12px', 
                    borderRadius: '4px',
                    textAlign: 'center',
                    border: `1px solid ${emittedEvents.length > 0 ? '#c3e6cb' : '#ffeaa7'}`
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      color: emittedEvents.length > 0 ? '#155724' : '#856404' 
                    }}>
                      {emittedEvents.length}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: emittedEvents.length > 0 ? '#155724' : '#856404' 
                    }}>
                      Emitted Events
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <strong style={{ color: '#495057' }}>Emits Events:</strong>
                <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                  {formatArray(hook.emits)}
                </div>
              </div>

              {!targetEvent && (
                <div style={{ 
                  background: '#f8d7da', 
                  border: '1px solid #f5c6cb', 
                  padding: '12px', 
                  borderRadius: '4px' 
                }}>
                  <strong style={{ color: '#721c24' }}>❌ Invalid Target Event</strong>
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#721c24' }}>
                    The event "{hook.event}" that this hook is listening to does not exist or is not registered.
                  </div>
                </div>
              )}

              {hook.overriddenBy && (
                <div style={{ 
                  background: '#fff3cd', 
                  border: '1px solid #ffeaa7', 
                  padding: '10px', 
                  borderRadius: '4px' 
                }}>
                  <strong style={{ color: '#856404' }}>⚠️ Overridden By:</strong>
                  <div style={{ fontSize: '13px', color: '#856404', marginTop: '4px', fontFamily: 'monospace' }}>
                    {hook.overriddenBy}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'event' && (
            <div>
              {targetEvent ? (
                <div>
                  <div style={{
                    background: '#f3e5f5',
                    border: '1px solid #e1bee7',
                    borderRadius: '6px',
                    padding: '16px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px' }}>📡</span>
                      <h4 style={{ margin: 0, color: '#4a148c' }}>
                        {targetEvent.meta?.title || formatId(targetEvent.id)}
                      </h4>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6a1b9a', marginBottom: '8px' }}>
                      {targetEvent.id}
                    </div>
                    {targetEvent.meta?.description && (
                      <div style={{ fontSize: '13px', color: '#6a1b9a', lineHeight: '1.4' }}>
                        {targetEvent.meta.description}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Event Details</h4>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div style={{
                        background: '#f8f9fa',
                        padding: '12px',
                        borderRadius: '4px',
                        border: '1px solid #e9ecef'
                      }}>
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>Payload Schema</div>
                        <pre style={{
                          background: '#fff',
                          padding: '8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          margin: 0,
                          border: '1px solid #dee2e6',
                          overflow: 'auto'
                        }}>
                          {targetEvent.payloadSchema || 'No schema defined'}
                        </pre>
                      </div>
                      
                      <div style={{
                        background: '#f8f9fa',
                        padding: '12px',
                        borderRadius: '4px',
                        border: '1px solid #e9ecef'
                      }}>
                        <div style={{ fontWeight: '500', marginBottom: '8px' }}>Event Statistics</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', color: '#007acc' }}>
                              {introspector.getEmittersOfEvent(targetEvent.id).length}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6c757d' }}>Emitters</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', color: '#9c27b0' }}>
                              {introspector.getHooksOfEvent(targetEvent.id).length}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6c757d' }}>Hooks</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ 
                  background: '#f8d7da', 
                  border: '1px solid #f5c6cb', 
                  padding: '20px', 
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <span style={{ fontSize: '48px' }}>❌</span>
                  <h4 style={{ color: '#721c24', margin: '10px 0' }}>Event Not Found</h4>
                  <p style={{ color: '#721c24', margin: 0 }}>
                    The target event "{hook.event}" does not exist in the current application.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dependencies' && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {dependencies.tasks.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Task Dependencies</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {dependencies.tasks.map(dep => (
                      <div key={dep.id} style={{
                        padding: '8px 12px',
                        background: '#e3f2fd',
                        borderRadius: '4px',
                        borderLeft: '4px solid #2196f3'
                      }}>
                        <div style={{ fontWeight: '500' }}>{dep.meta?.title || formatId(dep.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{dep.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dependencies.resources.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Resource Dependencies</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {dependencies.resources.map(dep => (
                      <div key={dep.id} style={{
                        padding: '8px 12px',
                        background: '#e8f5e8',
                        borderRadius: '4px',
                        borderLeft: '4px solid #4caf50'
                      }}>
                        <div style={{ fontWeight: '500' }}>{dep.meta?.title || formatId(dep.id)}</div>
                        <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{dep.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {emittedEvents.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Emitted Events</h4>
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

              {dependencies.tasks.length === 0 && dependencies.resources.length === 0 && emittedEvents.length === 0 && (
                <div style={{ 
                  color: '#6c757d', 
                  fontStyle: 'italic', 
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  This hook has no dependencies and emits no events.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};