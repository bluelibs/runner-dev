import { r } from "@bluelibs/runner";
import { z } from "zod";

// ====================
// USER DOMAIN ERRORS
// ====================

export const UserNotFoundError: any = r
  .error<{
    userId: string;
    message: string;
  }>("app.users.errors.userNotFound")
  .dataSchema(
    z.object({
      userId: z.string(),
      message: z.string(),
    })
  )
  .build();

export const InvalidCredentialsError: any = r
  .error<{
    email: string;
    attempts: number;
    message: string;
  }>("app.users.errors.invalidCredentials")
  .dataSchema(
    z.object({
      email: z.string().email(),
      attempts: z.number().int().min(0),
      message: z.string(),
    })
  )
  .build();

export const EmailAlreadyExistsError: any = r
  .error<{
    email: string;
    existingUserId: string;
    message: string;
  }>("app.users.errors.emailAlreadyExists")
  .dataSchema(
    z.object({
      email: z.string().email(),
      existingUserId: z.string(),
      message: z.string(),
    })
  )
  .build();

export const AccountLockedError: any = r
  .error<{
    userId: string;
    lockedUntil: Date;
    reason: string;
    message: string;
  }>("app.users.errors.accountLocked")
  .dataSchema(
    z.object({
      userId: z.string(),
      lockedUntil: z.date(),
      reason: z.string(),
      message: z.string(),
    })
  )
  .build();

// ====================
// PRODUCT DOMAIN ERRORS
// ====================

export const ProductNotFoundError: any = r
  .error<{
    productId: string;
    message: string;
  }>("app.products.errors.productNotFound")
  .dataSchema(
    z.object({
      productId: z.string(),
      message: z.string(),
    })
  )
  .build();

export const InsufficientStockError: any = r
  .error<{
    productId: string;
    requestedQuantity: number;
    availableQuantity: number;
    message: string;
  }>("app.products.errors.insufficientStock")
  .dataSchema(
    z.object({
      productId: z.string(),
      requestedQuantity: z.number().int().positive(),
      availableQuantity: z.number().int().min(0),
      message: z.string(),
    })
  )
  .build();

export const InvalidPriceError: any = r
  .error<{
    productId: string;
    providedPrice: number;
    minimumPrice: number;
    maximumPrice: number;
    message: string;
  }>("app.products.errors.invalidPrice")
  .dataSchema(
    z.object({
      productId: z.string(),
      providedPrice: z.number().positive(),
      minimumPrice: z.number().nonnegative(),
      maximumPrice: z.number().positive(),
      message: z.string(),
    })
  )
  .build();

export const CategoryNotFoundError: any = r
  .error<{
    categoryId: string;
    message: string;
  }>("app.products.errors.categoryNotFound")
  .dataSchema(
    z.object({
      categoryId: z.string(),
      message: z.string(),
    })
  )
  .build();

// ====================
// ORDER DOMAIN ERRORS
// ====================

export const PaymentFailedError: any = r
  .error<{
    orderId: string;
    paymentMethod: string;
    amount: number;
    failureReason: string;
    retryPossible: boolean;
    message: string;
  }>("app.orders.errors.paymentFailed")
  .dataSchema(
    z.object({
      orderId: z.string(),
      paymentMethod: z.string(),
      amount: z.number().positive(),
      failureReason: z.string(),
      retryPossible: z.boolean(),
      message: z.string(),
    })
  )
  .build();

export const OrderNotFoundError: any = r
  .error<{
    orderId: string;
    userId?: string;
    message: string;
  }>("app.orders.errors.orderNotFound")
  .dataSchema(
    z.object({
      orderId: z.string(),
      userId: z.string().optional(),
      message: z.string(),
    })
  )
  .build();

export const InvalidOrderStatusError: any = r
  .error<{
    orderId: string;
    currentStatus: string;
    requestedStatus: string;
    allowedTransitions: string[];
    message: string;
  }>("app.orders.errors.invalidOrderStatus")
  .dataSchema(
    z.object({
      orderId: z.string(),
      currentStatus: z.string(),
      requestedStatus: z.string(),
      allowedTransitions: z.array(z.string()),
      message: z.string(),
    })
  )
  .build();

export const OrderExpiredError: any = r
  .error<{
    orderId: string;
    expiredAt: Date;
    message: string;
  }>("app.orders.errors.orderExpired")
  .dataSchema(
    z.object({
      orderId: z.string(),
      expiredAt: z.date(),
      message: z.string(),
    })
  )
  .build();

// ====================
// SYSTEM ERRORS
// ====================

export const DatabaseConnectionError: any = r
  .error<{
    service: string;
    host: string;
    retryCount: number;
    originalError?: string;
    message: string;
  }>("app.system.errors.databaseConnection")
  .dataSchema(
    z.object({
      service: z.string(),
      host: z.string(),
      retryCount: z.number().int().min(0),
      originalError: z.string().optional(),
      message: z.string(),
    })
  )
  .build();

export const ServiceUnavailableError: any = r
  .error<{
    service: string;
    endpoint: string;
    statusCode?: number;
    expectedAvailability?: Date;
    message: string;
  }>("app.system.errors.serviceUnavailable")
  .dataSchema(
    z.object({
      service: z.string(),
      endpoint: z.string(),
      statusCode: z.number().int().optional(),
      expectedAvailability: z.date().optional(),
      message: z.string(),
    })
  )
  .build();

export const RateLimitExceededError: any = r
  .error<{
    clientId: string;
    endpoint: string;
    limit: number;
    windowMs: number;
    resetTime: Date;
    message: string;
  }>("app.system.errors.rateLimitExceeded")
  .dataSchema(
    z.object({
      clientId: z.string(),
      endpoint: z.string(),
      limit: z.number().int().positive(),
      windowMs: z.number().int().positive(),
      resetTime: z.date(),
      message: z.string(),
    })
  )
  .build();

export const ValidationError: any = r
  .error<{
    field: string;
    value: any;
    constraint: string;
    message: string;
  }>("app.system.errors.validation")
  .dataSchema({
    parse: (value: any) => value,
  } as any)
  .build();

// ====================
// ERROR COLLECTIONS
// ====================

export const UserDomainErrors: Record<string, any> = {
  UserNotFoundError,
  InvalidCredentialsError,
  EmailAlreadyExistsError,
  AccountLockedError,
} as const;

export const ProductDomainErrors: Record<string, any> = {
  ProductNotFoundError,
  InsufficientStockError,
  InvalidPriceError,
  CategoryNotFoundError,
} as const;

export const OrderDomainErrors: Record<string, any> = {
  PaymentFailedError,
  OrderNotFoundError,
  InvalidOrderStatusError,
  OrderExpiredError,
} as const;

export const SystemErrors: Record<string, any> = {
  DatabaseConnectionError,
  ServiceUnavailableError,
  RateLimitExceededError,
  ValidationError,
} as const;

export const AllErrors: Record<string, any> = {
  ...UserDomainErrors,
  ...ProductDomainErrors,
  ...OrderDomainErrors,
  ...SystemErrors,
} as const;