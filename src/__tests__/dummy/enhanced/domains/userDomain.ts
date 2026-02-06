import { r } from "@bluelibs/runner";
import {
  UserDomainErrors,
  ValidationError,
  EmailAlreadyExistsError,
  AccountLockedError,
  InvalidCredentialsError,
} from "../errors";
import {
  RequestContext,
  AuditContext,
  SecurityContext,
  TenantContext,
  requestContextMiddleware,
  auditContextMiddleware,
} from "../contexts";

// Simple user events
export const userEnhancedRegisteredEvent = r
  .event("app.users.events.enhancedRegistered")
  .build();

export const userAuthenticationFailedEvent = r
  .event("app.users.events.authenticationFailed")
  .build();

export const userSuspiciousActivityEvent = r
  .event("app.users.events.suspiciousActivity")
  .build();

// Simple user resources
export const enhancedUserDatabaseResource = r
  .resource("app.users.resources.enhancedDatabase")
  .dependencies({
    requestContext: RequestContext,
    auditContext: AuditContext,
  })
  .init(async (_config, deps) => {
    return { connected: true };
  })
  .build();

export const userSecurityServiceResource = r
  .resource("app.users.resources.securityService")
  .dependencies({
    securityContext: SecurityContext,
    auditContext: AuditContext,
  })
  .init(async (_config, deps) => {
    // const audit = deps.auditContext.use();
    // console.log(`[${audit?.traceId}] Initializing user security service`);
    return { initializedAt: new Date() };
  })
  .build();

// Simple user tasks
export const enhancedRegisterUserTask = r
  .task("app.users.tasks.enhancedRegister")
  .dependencies({
    db: enhancedUserDatabaseResource,
    securityService: userSecurityServiceResource,
    requestContext: RequestContext,
    auditContext: AuditContext,
    securityContext: SecurityContext,
    tenantContext: TenantContext,
    emitUserRegistered: userEnhancedRegisteredEvent,
  })
  .middleware([requestContextMiddleware, auditContextMiddleware])
  .run(async (input, deps) => {
    return { userId: `user_${Date.now()}` };
  })
  .build();

export const enhancedAuthenticateUserTask = r
  .task("app.users.tasks.enhancedAuthenticate")
  .dependencies({
    db: enhancedUserDatabaseResource,
    requestContext: RequestContext,
    auditContext: AuditContext,
    securityContext: SecurityContext,
    emitAuthFailed: userAuthenticationFailedEvent,
    emitSuspiciousActivity: userSuspiciousActivityEvent,
  })
  .middleware([requestContextMiddleware, auditContextMiddleware])
  .run(async (input, deps) => {
    return { userId: `user_${Date.now()}` };
  })
  .build();

// Simple user hooks
export const userRegistrationSecurityHook = r
  .hook("app.users.hooks.registrationSecurity")
  .on(userEnhancedRegisteredEvent)
  .dependencies({
    securityService: userSecurityServiceResource,
    auditContext: AuditContext,
  })
  .run(async (event, { securityService, auditContext }) => {
    // Security analysis logic
  })
  .build();

export const userSuspiciousActivityHook = r
  .hook("app.users.hooks.suspiciousActivityHandler")
  .on(userSuspiciousActivityEvent)
  .dependencies({
    securityService: userSecurityServiceResource,
    auditContext: AuditContext,
  })
  .run(async (event, { securityService, auditContext }) => {
    // Suspicious activity handling logic
  })
  .build();
