import { describe, expect, it } from "vitest"

import { asStringArray, isIsoTimestamp, isJsonRequest, jsonError } from "@/server/api/http"

describe("jsonError", () => {
  it("should_return_error_envelope_when_status_and_message_are_provided", async () => {
    const response = jsonError(422, "invalid_request", "Bad payload", { field: "depth" })
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload).toEqual({
      error: {
        code: "invalid_request",
        message: "Bad payload",
        details: { field: "depth" }
      }
    })
  })
})

describe("isJsonRequest", () => {
  it("should_return_true_when_content_type_includes_application_json", () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: "{}"
    })

    expect(isJsonRequest(request)).toBe(true)
  })

  it("should_return_false_when_content_type_is_missing_or_not_json", () => {
    const noHeaderRequest = new Request("http://localhost/test", {
      method: "POST",
      body: "{}"
    })
    const textRequest = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}"
    })

    expect(isJsonRequest(noHeaderRequest)).toBe(false)
    expect(isJsonRequest(textRequest)).toBe(false)
  })
})

describe("asStringArray", () => {
  it("should_return_only_string_items_when_array_contains_mixed_values", () => {
    expect(asStringArray(["a", 1, null, "b", false])).toEqual(["a", "b"])
  })

  it("should_return_empty_array_when_input_is_not_array", () => {
    expect(asStringArray("not-array")).toEqual([])
  })
})

describe("isIsoTimestamp", () => {
  it("should_return_true_when_timestamp_is_valid", () => {
    expect(isIsoTimestamp("2024-06-01T00:00:00.000Z")).toBe(true)
  })

  it("should_return_false_when_timestamp_is_invalid", () => {
    expect(isIsoTimestamp("not-a-date")).toBe(false)
  })
})
