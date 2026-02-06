export {
  // User domain exports
  userEnhancedRegisteredEvent,
  userAuthenticationFailedEvent,
  userSuspiciousActivityEvent,
  enhancedUserDatabaseResource,
  userSecurityServiceResource,
  enhancedRegisterUserTask,
  enhancedAuthenticateUserTask,
  userRegistrationSecurityHook,
  userSuspiciousActivityHook,
} from "./userDomain";

export {
  // Product domain exports
  productEnhancedCreatedEvent,
  productInventoryCriticalEvent,
  productPriceChangeRequestedEvent,
  enhancedProductDatabaseResource,
  productPricingEngineResource,
    enhancedCreateProductTask,
  enhancedUpdateInventoryTask,
  productPriceOptimizationHook,
  productInventoryRestockHook,
} from "./productDomain";

// Import required errors and contexts for domain usage
export {
  UserDomainErrors,
  ProductDomainErrors,
  OrderDomainErrors,
  SystemErrors,
  ValidationError,
  DatabaseConnectionError,
  ServiceUnavailableError,
  RateLimitExceededError,
  EmailAlreadyExistsError,
  AccountLockedError,
  InvalidCredentialsError,
  ProductNotFoundError,
  InvalidPriceError,
  OrderNotFoundError,
  InsufficientStockError,
  PaymentFailedError,
    AllErrors,
} from "../errors";

export {
  RequestContext,
  AuditContext,
  SecurityContext,
  TenantContext,
  BusinessContext,
  PerformanceContext,
  CacheContext,
  requestContextMiddleware,
  auditContextMiddleware,
  performanceContextMiddleware,
  CoreContexts,
  BusinessContexts,
  SystemContexts,
  AllContexts,
  ContextMiddleware,
} from "../contexts";

// Tunneling exports
export {
  tunnelClient,
  enhancedRegisterUserTask as tunnelRegisterUserTask,
  enhancedProductSyncTask,
  enhancedProcessOrderTask,
  generateBusinessReportTask,
  tunnelClientApp,
  startTunnelClient,
} from "../tunneling/client";