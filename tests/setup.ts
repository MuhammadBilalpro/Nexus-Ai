import "dotenv/config";

// Integration tests run against the dedicated test database, never dev/prod.
const testUrl = process.env["TEST_DATABASE_URL"] ?? "postgresql://nexus:nexus_dev_only@localhost:5432/nexus_test";
process.env["DATABASE_URL"] = testUrl;
Object.assign(process.env, { NODE_ENV: "test" });
process.env["AUTH_SECRET"] ??= "test-secret-test-secret-test-secret-123456";
process.env["MFA_ENCRYPTION_KEY"] ??= "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
process.env["DEMO_MODE"] = "false";
