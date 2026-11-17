import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "../src/shared/csv";

describe("csv", () =>
{
    it("reads quoted fields with commas, quotes and newlines", () =>
    {
        expect(parseCsv('email,name\r\na@b.co,"Doe, ""Jo""\nJr"\n')).toEqual([["email", "name"], ["a@b.co", 'Doe, "Jo"\nJr']]);
    });

    it("round-trips", () =>
    {
        const rows = [["a", "b,c"], ['x"y', ""]];
        expect(parseCsv(toCsv(rows))).toEqual(rows);
    });
});
