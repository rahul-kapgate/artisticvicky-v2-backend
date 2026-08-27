import request from "supertest";
import app from "../src/app.js";

describe("GET /health", () => {
  // Test 1
  it("should return 200 status code", async () => {
    const response = await request(app).get("/health");

    expect(response.statusCode).toBe(200);
  });

  // Test 2
  it("should return success as true", async () => {
    const response = await request(app).get("/health");

    expect(response.body.success).toBe(true);
  });

  // Test 3
  it("should return correct message", async () => {
    const response = await request(app).get("/health");

    expect(response.body.message).toBe("Server is healthy");
  });

  // Test 4
  it("should return JSON response", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["content-type"]).toMatch(/json/);
  });

  // Test 5
  it("should return the correct response structure", async () => {
    const response = await request(app).get("/health");

    expect(response.body).toEqual({
      message: "Server is healthy",
      success: true,
    });
  });

  // Test 6
  it("should contain only message and success fields", async () => {
    const response = await request(app).get("/health");

    expect(Object.keys(response.body)).toHaveLength(2);
    expect(response.body).toHaveProperty("message");
    expect(response.body).toHaveProperty("success");
  });
});