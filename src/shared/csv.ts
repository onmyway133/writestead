// Small RFC 4180 CSV reader and writer: quoted fields, escaped quotes, CRLF or LF.

export function parseCsv(input: string): string[][]
{
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;
    const text = input.replace(/^﻿/, "");
    for (let index = 0; index < text.length; index++)
    {
        const char = text[index];
        if (quoted)
        {
            if (char === '"' && text[index + 1] === '"')
            {
                field += '"';
                index++;
            }
            else if (char === '"')
            {
                quoted = false;
            }
            else
            {
                field += char;
            }
            continue;
        }
        if (char === '"')
        {
            quoted = true;
        }
        else if (char === ",")
        {
            row.push(field);
            field = "";
        }
        else if (char === "\n" || char === "\r")
        {
            if (char === "\r" && text[index + 1] === "\n")
            {
                index++;
            }
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        }
        else
        {
            field += char;
        }
    }
    if (field !== "" || row.length > 0)
    {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

export function toCsv(rows: string[][]): string
{
    return rows.map((row) => row.map((cell) => (/[",\n\r]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(",")).join("\n") + "\n";
}
