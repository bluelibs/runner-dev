# Chat Implementation Migration Guide

## Overview

The chat implementation has been migrated from traditional React hooks to the @bluelibs/smart state management framework. This guide helps you migrate from the old implementation to the new Smart-based approach.

## 🎯 Quick Migration

### Old Implementation (Deprecated)
```typescript
import { useChatState } from './chat/useChatState';

const chatHook = useChatState({
  availableElements,
  docs: docsBundle
});
```

### New Implementation (Recommended)
```typescript
import { useChatStateSmart } from './chat/useChatStateSmart';

const chatHook = useChatStateSmart({
  availableElements,
  docs: docsBundle
});
```

## 📋 Migration Steps

### 1. Update Import
```typescript
// Remove
import { useChatState } from './chat/useChatState';

// Add
import { useChatStateSmart } from './chat/useChatStateSmart';
```

### 2. Update Hook Usage
```typescript
// Old (deprecated)
const chatHook = useChatState(options);

// New (recommended)
const chatHook = useChatStateSmart(options);
```

### 3. No API Changes Required
The Smart implementation maintains 100% API compatibility:
- `chatState` - Same structure
- `setChatState` - Same function signature
- `sendMessage` - Same method
- All other methods - Identical

## 🚀 Benefits of Smart Implementation

- **Better State Management**: Centralized state with automatic reactivity
- **Improved Testability**: 700 lines vs 1152 lines, easier to test
- **Cleaner Architecture**: Separation of business logic from React concerns
- **Automatic React Re-renders**: No manual dependency management
- **Feature Flag Support**: Gradual migration with zero downtime

## 🔧 Feature Flag Usage

### Enable Smart Implementation

#### Environment Variables
```bash
REACT_APP_USE_SMART_CHAT=true
# or
NEXT_PUBLIC_USE_SMART_CHAT=true
```

#### URL Parameter
```
https://your-app.com/docs?useSmartChat=true
```

#### Programmatic Check
```typescript
const useSmartChat = process.env.REACT_APP_USE_SMART_CHAT === 'true' ||
                   window.location.search.includes('useSmartChat=true');
```

## 📚 Implementation Details

### Architecture Comparison

| Aspect | Old (useChatState) | New (useChatStateSmart) |
|--------|-------------------|------------------------|
| Lines of Code | 1152 lines | 89 lines (hook) + 700 lines (Smart class) |
| State Management | React useState | @bluelibs/smart |
| Business Logic | Mixed with React | Separated in Smart class |
| Testability | Complex (requires React Testing Library) | Simple (plain unit tests) |
| Re-renders | Manual dependency management | Automatic via Smart reactivity |
| Error Handling | Scattered | Centralized in Smart class |

### File Structure
```
chat/
├── useChatState.ts           # ❌ Deprecated (1152 lines)
├── useChatStateSmart.ts      # ✅ New implementation (89 lines)
├── ChatSmart.ts             # ✅ Smart class (700 lines)
├── ChatSmart.test.ts        # ✅ Comprehensive tests
├── hooks/
│   └── useOpenAIResponder.ts # ❌ Deprecated (used by old implementation)
└── MIGRATION_GUIDE.md       # 📖 This file
```

## 🧪 Testing

### Old Implementation Tests
Complex, requiring React Testing Library and component mounting.

### New Implementation Tests
Simple unit tests for the Smart class:
```typescript
describe('ChatSmart', () => {
  let chatSmart: ChatSmart;

  beforeEach(() => {
    chatSmart = new ChatSmart(mockDocsBundle, mockAvailableElements);
  });

  test('should send messages', async () => {
    await chatSmart.sendMessage('test message');
    expect(chatSmart.messages).toHaveLength(2); // welcome + new
  });
});
```

## 🎛️ Advanced Usage

### Direct Smart Class Usage
You can use the Smart class directly in non-React contexts:
```typescript
import { ChatSmart } from './chat/ChatSmart';

const chatModel = new ChatSmart(docsBundle, availableElements);
await chatModel.sendMessage('Direct usage');
```

### Custom Smart Extensions
```typescript
class CustomChatSmart extends ChatSmart {
  customMethod() {
    // Your custom functionality
  }
}
```

## 📝 Deprecation Timeline

- **Current**: Old implementation marked as deprecated but functional
- **Next Major Version**: Old implementation may be removed
- **Recommended**: Migrate to Smart implementation as soon as possible

## 🆘 Troubleshooting

### Common Issues

1. **Import Errors**: Ensure you're importing from `useChatStateSmart`
2. **Type Errors**: Make sure to import types from `ChatTypes` and `ChatUtils`
3. **Feature Flag Not Working**: Check environment variable names and URL parameter format

### Getting Help

- Check the Smart class documentation: `ChatSmart.ts`
- Review test examples: `ChatSmart.test.ts`
- Open an issue with the specific error you're encountering

---

**Note**: The Smart implementation is fully backward compatible. You can migrate gradually using feature flags without any breaking changes.