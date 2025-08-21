import React, { useState } from 'react';
import { Event } from '../../../schema/model';
import { Introspector } from '../../../resources/introspector.resource';
import { formatSchema, formatFilePath, formatArray, formatId } from '../utils/formatting';

export interface EventCardProps {
  event: Event;
  introspector: Introspector;
}

export const EventCard: React.FC<EventCardProps> = ({ event, introspector }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'schema' | 'relationships'>('overview');

  const emitters = introspector.getEmittersOfEvent(event.id);
  const hooks = introspector.getHooksOfEvent(event.id);

  const cardStyle = {
    background: '#fff',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    overflow: 'hidden' as const,
    transition: 'box-shadow 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #ffc107, #ff8f00)',
    color: 'white',
    padding: '20px',
    cursor: 'pointer'
  };

  const contentStyle = {
    padding: '20px'
  };

  const getEventIcon = () => {
    if (hooks.length > 0 && emitters.length > 0) return '📡';
    if (emitters.length > 0) return '📤';
    if (hooks.length > 0) return '📥';
    return '📋';
  };

  const getEventStatus = () => {
    if (emitters.length === 0 && hooks.length === 0) return { text: 'Unused', color: '#6c757d' };
    if (emitters.length === 0) return { text: 'No Emitters', color: '#dc3545' };
    if (hooks.length === 0) return { text: 'No Listeners', color: '#fd7e14' };
    return { text: 'Active', color: '#28a745' };
  };

  const status = getEventStatus();

  return (
    <div style={cardStyle}>
      <div style={headerStyle} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>{getEventIcon()}</span>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                {event.meta?.title || formatId(event.id)}
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
              {event.id}
            </div>
            {event.meta?.description && (
              <p style={{ margin: '10px 0 0 0', fontSize: '14px', opacity: 0.95, lineHeight: '1.4' }}>
                {event.meta.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 8px',
                borderRadius: '12px'
              }}>
                <span style={{ fontSize: '12px' }}>📤</span>
                <span style={{ fontSize: '12px', fontWeight: '500' }}>{emitters.length}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 8px',
                borderRadius: '12px'
              }}>
                <span style={{ fontSize: '12px' }}>📥</span>
                <span style={{ fontSize: '12px', fontWeight: '500' }}>{hooks.length}</span>
              </div>
            </div>
            {event.meta?.tags && event.meta.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {event.meta.tags.slice(0, 2).map(tag => (
                  <span key={tag} style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {tag}
                  </span>
                ))}
                {event.meta.tags.length > 2 && (
                  <span style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    +{event.meta.tags.length - 2}
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
              { id: 'schema', label: 'Payload Schema' },
              { id: 'relationships', label: 'Relationships' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: activeTab === tab.id ? '#ffc107' : 'transparent',
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
                  {formatFilePath(event.filePath)}
                </div>
              </div>

              {event.registeredBy && (
                <div>
                  <strong style={{ color: '#495057' }}>Registered By:</strong>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                    {event.registeredBy}
                  </div>
                </div>
              )}

              <div>
                <strong style={{ color: '#495057' }}>Event Flow:</strong>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '10px', 
                  marginTop: '8px' 
                }}>
                  <div style={{ 
                    background: emitters.length > 0 ? '#d4edda' : '#f8d7da', 
                    padding: '8px 12px', 
                    borderRadius: '4px',
                    textAlign: 'center',
                    border: `1px solid ${emitters.length > 0 ? '#c3e6cb' : '#f5c6cb'}`
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      color: emitters.length > 0 ? '#155724' : '#721c24' 
                    }}>
                      {emitters.length}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: emitters.length > 0 ? '#155724' : '#721c24' 
                    }}>
                      Emitters
                    </div>
                  </div>
                  <div style={{ 
                    background: hooks.length > 0 ? '#d4edda' : '#fff3cd', 
                    padding: '8px 12px', 
                    borderRadius: '4px',
                    textAlign: 'center',
                    border: `1px solid ${hooks.length > 0 ? '#c3e6cb' : '#ffeaa7'}`
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      color: hooks.length > 0 ? '#155724' : '#856404' 
                    }}>
                      {hooks.length}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: hooks.length > 0 ? '#155724' : '#856404' 
                    }}>
                      Listeners
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <strong style={{ color: '#495057' }}>Listened To By:</strong>
                <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                  {formatArray(event.listenedToBy)}
                </div>
              </div>

              {(emitters.length === 0 || hooks.length === 0) && (
                <div style={{ 
                  background: emitters.length === 0 ? '#f8d7da' : '#fff3cd', 
                  border: `1px solid ${emitters.length === 0 ? '#f5c6cb' : '#ffeaa7'}`, 
                  padding: '12px', 
                  borderRadius: '4px' 
                }}>
                  <strong style={{ 
                    color: emitters.length === 0 ? '#721c24' : '#856404' 
                  }}>
                    {emitters.length === 0 ? '⚠️ No Emitters Found' : '⚠️ No Listeners Found'}
                  </strong>
                  <div style={{ 
                    marginTop: '8px', 
                    fontSize: '13px', 
                    color: emitters.length === 0 ? '#721c24' : '#856404' 
                  }}>
                    {emitters.length === 0 
                      ? 'This event is not emitted by any tasks, hooks, or resources.'
                      : 'This event has no hooks listening to it.'
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'schema' && (
            <div>
              <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>Payload Schema</h4>
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
                {formatSchema(event.payloadSchema)}
              </pre>
            </div>
          )}

          {activeTab === 'relationships' && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {emitters.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>
                    Event Emitters ({emitters.length})
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {emitters.map(emitter => {
                      let bgColor = '#f8f9fa';
                      let borderColor = '#dee2e6';
                      let icon = '📤';
                      
                      // Determine the type of emitter
                      if ('emits' in emitter && Array.isArray(emitter.emits)) {
                        if ('dependsOn' in emitter && 'middleware' in emitter) {
                          // It's a Task
                          bgColor = '#e3f2fd';
                          borderColor = '#2196f3';
                          icon = '⚙️';
                        } else if ('event' in emitter) {
                          // It's a Hook
                          bgColor = '#f3e5f5';
                          borderColor = '#9c27b0';
                          icon = '🪝';
                        }
                      } else if ('config' in emitter) {
                        // It's a Resource
                        bgColor = '#e8f5e8';
                        borderColor = '#4caf50';
                        icon = '🔧';
                      }

                      return (
                        <div key={emitter.id} style={{
                          padding: '12px',
                          background: bgColor,
                          borderRadius: '4px',
                          borderLeft: `4px solid ${borderColor}`
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{icon}</span>
                            <div>
                              <div style={{ fontWeight: '500' }}>
                                {emitter.meta?.title || formatId(emitter.id)}
                              </div>
                              <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
                                {emitter.id}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {hooks.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>
                    Event Listeners ({hooks.length})
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {hooks.map(hook => (
                      <div key={hook.id} style={{
                        padding: '12px',
                        background: '#f3e5f5',
                        borderRadius: '4px',
                        borderLeft: '4px solid #9c27b0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>🪝</span>
                              <div>
                                <div style={{ fontWeight: '500' }}>
                                  {hook.meta?.title || formatId(hook.id)}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
                                  {hook.id}
                                </div>
                              </div>
                            </div>
                            {hook.meta?.description && (
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#666', 
                                marginTop: '4px',
                                fontStyle: 'italic'
                              }}>
                                {hook.meta.description}
                              </div>
                            )}
                          </div>
                          {hook.hookOrder !== null && hook.hookOrder !== undefined && (
                            <span style={{
                              background: '#e1bee7',
                              color: '#4a148c',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '500'
                            }}>
                              Order: {hook.hookOrder}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {emitters.length === 0 && hooks.length === 0 && (
                <div style={{ 
                  color: '#6c757d', 
                  fontStyle: 'italic', 
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  This event has no emitters or listeners.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};