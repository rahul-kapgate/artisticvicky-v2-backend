import { validateResolvedCourseInput } from "../../src/modules/course/admin/course-admin.validation.js";

describe("course update validation", () => {
  test("rejects paid course with zero price", () => {
    expect(() =>
      validateResolvedCourseInput({
        isFree: false,
        priceAmount: 0,
        salePriceAmount: null,

        accessType: "lifetime",
        accessDurationDays: null,
        accessEndAt: null,
      }),
    ).toThrow();
  });

  test("rejects sale price greater than regular price", () => {
    expect(() =>
      validateResolvedCourseInput({
        isFree: false,
        priceAmount: 500000,
        salePriceAmount: 600000,

        accessType: "lifetime",
        accessDurationDays: null,
        accessEndAt: null,
      }),
    ).toThrow();
  });

  test("accepts duration access", () => {
    expect(() =>
      validateResolvedCourseInput({
        isFree: false,
        priceAmount: 500000,
        salePriceAmount: 400000,

        accessType: "duration",
        accessDurationDays: 90,
        accessEndAt: null,
      }),
    ).not.toThrow();
  });

  test("rejects fixed date in the past", () => {
    expect(() =>
      validateResolvedCourseInput({
        isFree: true,
        priceAmount: 0,
        salePriceAmount: null,

        accessType: "fixed_date",
        accessDurationDays: null,
        accessEndAt: "2020-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("course publishing", () => {
  test("rejects publishing when required fields are missing", () => {});

  test("rejects fixed-date course when access end date has passed", () => {});

  test("publishes a valid draft course", () => {});

  test("archives a published course", () => {});
});
