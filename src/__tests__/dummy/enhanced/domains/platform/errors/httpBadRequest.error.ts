import { r } from "@bluelibs/runner";
import {
  type InvalidInputErrorData,
  InvalidInputErrorDataSchema,
} from "../../../schemas";

export const invalidInputError = r
  .error<InvalidInputErrorData>("http-bad-request")
  .dataSchema(InvalidInputErrorDataSchema)
  .httpCode(400)
  .meta({
    title: "HTTP Bad Request",
    description:
      "Typed validation failure raised by request-facing tasks.\n\n- Keeps the public error surface visible in docs\n- Shows where invalid input is rejected",
  })
  .build();
