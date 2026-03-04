import { Match } from "@bluelibs/runner";

const schema = Match.Schema as (...args: any[]) => ClassDecorator;
const applyField = (target: object, key: string, pattern: unknown) => {
  Match.Field(pattern as never)(target as never, key as never);
};

export const regionPattern: any = Match.OneOf("US", "EU", "APAC");

export const positiveNumberPattern: any = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0
);

export const nonNegativeIntegerPattern: any = Match.Where(
  (value): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0
);

@schema()
export class InterceptorInputSchema {
  value!: number;
}
applyField(InterceptorInputSchema.prototype, "value", Number);

@schema()
export class InterceptorResultSchema {
  value!: number;
  intercepted!: boolean;
}
applyField(InterceptorResultSchema.prototype, "value", Number);
applyField(InterceptorResultSchema.prototype, "intercepted", Boolean);

@schema()
export class FeaturedTagConfigSchema {
  source!: "catalog" | "search";
}
applyField(
  FeaturedTagConfigSchema.prototype,
  "source",
  Match.OneOf("catalog", "search")
);

@schema()
export class CatalogSearchInputSchema {
  query?: string;
}
applyField(CatalogSearchInputSchema.prototype, "query", Match.Optional(String));

@schema()
export class CatalogSearchResultSchema {
  query!: string;
  total!: number;
}
applyField(CatalogSearchResultSchema.prototype, "query", String);
applyField(CatalogSearchResultSchema.prototype, "total", nonNegativeIntegerPattern);

@schema()
export class FeaturedInspectorResultSchema {
  taggedTaskIds!: string[];
  taggedResourceIds!: string[];
}
applyField(
  FeaturedInspectorResultSchema.prototype,
  "taggedTaskIds",
  Match.ArrayOf(String)
);
applyField(
  FeaturedInspectorResultSchema.prototype,
  "taggedResourceIds",
  Match.ArrayOf(String)
);

@schema()
export class RpcPricingPreviewInputSchema {
  sku!: string;
  basePrice!: number;
  region?: "US" | "EU" | "APAC";
}
applyField(RpcPricingPreviewInputSchema.prototype, "sku", String);
applyField(RpcPricingPreviewInputSchema.prototype, "basePrice", positiveNumberPattern);
applyField(
  RpcPricingPreviewInputSchema.prototype,
  "region",
  Match.Optional(regionPattern)
);

@schema()
export class RpcPricingPreviewResultSchema {
  sku!: string;
  adjustedPrice!: number;
  source!: "rpc-lane-task";
}
applyField(RpcPricingPreviewResultSchema.prototype, "sku", String);
applyField(
  RpcPricingPreviewResultSchema.prototype,
  "adjustedPrice",
  positiveNumberPattern
);
applyField(
  RpcPricingPreviewResultSchema.prototype,
  "source",
  Match.OneOf("rpc-lane-task")
);

@schema()
export class RpcCatalogSyncInputSchema {
  supplierId!: string;
  changedSkus!: string[];
}
applyField(RpcCatalogSyncInputSchema.prototype, "supplierId", String);
applyField(
  RpcCatalogSyncInputSchema.prototype,
  "changedSkus",
  Match.NonEmptyArray(String)
);

@schema()
export class RpcCatalogSyncResultSchema {
  supplierId!: string;
  syncedCount!: number;
  emittedEvent!: string;
}
applyField(RpcCatalogSyncResultSchema.prototype, "supplierId", String);
applyField(
  RpcCatalogSyncResultSchema.prototype,
  "syncedCount",
  nonNegativeIntegerPattern
);
applyField(RpcCatalogSyncResultSchema.prototype, "emittedEvent", String);

@schema()
export class LaneCatalogUpdatedPayloadSchema {
  supplierId!: string;
  updatedAt!: Date;
}
applyField(LaneCatalogUpdatedPayloadSchema.prototype, "supplierId", String);
applyField(LaneCatalogUpdatedPayloadSchema.prototype, "updatedAt", Date);

@schema()
export class LaneCatalogProjectionUpdatedPayloadSchema {
  supplierId!: string;
  projectedAt!: Date;
}
applyField(
  LaneCatalogProjectionUpdatedPayloadSchema.prototype,
  "supplierId",
  String
);
applyField(LaneCatalogProjectionUpdatedPayloadSchema.prototype, "projectedAt", Date);

@schema()
export class DurableOrderApprovalInputSchema {
  orderId!: string;
  amount!: number;
  region!: "US" | "EU" | "APAC";
}
applyField(DurableOrderApprovalInputSchema.prototype, "orderId", String);
applyField(DurableOrderApprovalInputSchema.prototype, "amount", positiveNumberPattern);
applyField(
  DurableOrderApprovalInputSchema.prototype,
  "region",
  Match.OneOf("US", "EU", "APAC")
);

@schema()
export class DurableOrderApprovalResultSchema {
  orderId!: string;
  status!: "approved";
  riskScore!: number;
  approvalReference!: string;
  cooldownMs!: number;
}
applyField(DurableOrderApprovalResultSchema.prototype, "orderId", String);
applyField(
  DurableOrderApprovalResultSchema.prototype,
  "status",
  Match.OneOf("approved")
);
applyField(
  DurableOrderApprovalResultSchema.prototype,
  "riskScore",
  Match.Where(
    (value): value is number =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100
  )
);
applyField(DurableOrderApprovalResultSchema.prototype, "approvalReference", String);
applyField(
  DurableOrderApprovalResultSchema.prototype,
  "cooldownMs",
  nonNegativeIntegerPattern
);

@schema()
export class DurableExecutionIdResultSchema {
  executionId!: string;
}
applyField(DurableExecutionIdResultSchema.prototype, "executionId", String);

@schema()
export class SupportProbeInputSchema {
  fail?: boolean;
  requestId?: string;
}
applyField(SupportProbeInputSchema.prototype, "fail", Match.Optional(Boolean));
applyField(SupportProbeInputSchema.prototype, "requestId", Match.Optional(String));

@schema()
export class SupportProbeResultSchema {
  ok!: boolean;
  requestId!: string;
}
applyField(SupportProbeResultSchema.prototype, "ok", Boolean);
applyField(SupportProbeResultSchema.prototype, "requestId", String);

@schema()
export class InvalidInputErrorDataSchema {
  field!: string;
  message!: string;
}
applyField(InvalidInputErrorDataSchema.prototype, "field", String);
applyField(InvalidInputErrorDataSchema.prototype, "message", String);

export type InvalidInputErrorData = {
  field: string;
  message: string;
};
