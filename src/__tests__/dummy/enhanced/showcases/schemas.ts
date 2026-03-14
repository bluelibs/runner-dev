import { Match } from "@bluelibs/runner";

const schema = Match.Schema as (...args: any[]) => ClassDecorator;

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
  @Match.Field(Number)
  value!: number;
}

@schema()
export class InterceptorResultSchema {
  @Match.Field(Number)
  value!: number;

  @Match.Field(Boolean)
  intercepted!: boolean;
}

@schema()
export class FeaturedTagConfigSchema {
  @Match.Field(Match.OneOf("catalog", "search"))
  source!: "catalog" | "search";
}

@schema()
export class CatalogSearchInputSchema {
  @Match.Field(Match.Optional(String))
  query?: string;
}

@schema()
export class CatalogSearchResultSchema {
  @Match.Field(String)
  query!: string;

  @Match.Field(nonNegativeIntegerPattern)
  total!: number;
}

@schema()
export class FeaturedInspectorResultSchema {
  @Match.Field(Match.ArrayOf(String))
  taggedTaskIds!: string[];

  @Match.Field(Match.ArrayOf(String))
  taggedResourceIds!: string[];
}

@schema()
export class RpcPricingPreviewInputSchema {
  @Match.Field(String)
  sku!: string;

  @Match.Field(positiveNumberPattern)
  basePrice!: number;

  @Match.Field(Match.Optional(regionPattern))
  region?: "US" | "EU" | "APAC";
}

@schema()
export class RpcPricingPreviewResultSchema {
  @Match.Field(String)
  sku!: string;

  @Match.Field(positiveNumberPattern)
  adjustedPrice!: number;

  @Match.Field(Match.OneOf("rpc-lane-task"))
  source!: "rpc-lane-task";
}

@schema()
export class RpcCatalogSyncInputSchema {
  @Match.Field(String)
  supplierId!: string;

  @Match.Field(Match.NonEmptyArray(String))
  changedSkus!: string[];
}

@schema()
export class RpcCatalogSyncResultSchema {
  @Match.Field(String)
  supplierId!: string;

  @Match.Field(nonNegativeIntegerPattern)
  syncedCount!: number;

  @Match.Field(String)
  emittedEvent!: string;
}

@schema()
export class LaneCatalogUpdatedPayloadSchema {
  @Match.Field(String)
  supplierId!: string;

  @Match.Field(Date)
  updatedAt!: Date;
}

@schema()
export class LaneCatalogProjectionUpdatedPayloadSchema {
  @Match.Field(String)
  supplierId!: string;

  @Match.Field(Date)
  projectedAt!: Date;
}

@schema()
export class DurableOrderApprovalInputSchema {
  @Match.Field(String)
  orderId!: string;

  @Match.Field(positiveNumberPattern)
  amount!: number;

  @Match.Field(Match.OneOf("US", "EU", "APAC"))
  region!: "US" | "EU" | "APAC";
}

@schema()
export class DurableOrderApprovalResultSchema {
  @Match.Field(String)
  orderId!: string;

  @Match.Field(Match.OneOf("approved"))
  status!: "approved";

  @Match.Field(
    Match.Where(
      (value): value is number =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100
    )
  )
  riskScore!: number;

  @Match.Field(String)
  approvalReference!: string;

  @Match.Field(nonNegativeIntegerPattern)
  cooldownMs!: number;
}

@schema()
export class DurableExecutionIdResultSchema {
  @Match.Field(String)
  executionId!: string;
}

@schema()
export class SupportProbeInputSchema {
  @Match.Field(Match.Optional(Boolean))
  fail?: boolean;

  @Match.Field(Match.Optional(String))
  requestId?: string;
}

@schema()
export class SupportProbeResultSchema {
  @Match.Field(Boolean)
  ok!: boolean;

  @Match.Field(String)
  requestId!: string;
}

@schema()
export class InvalidInputErrorDataSchema {
  @Match.Field(String)
  field!: string;

  @Match.Field(String)
  message!: string;
}

export type InvalidInputErrorData = {
  field: string;
  message: string;
};
