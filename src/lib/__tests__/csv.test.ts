import { describe, expect, it } from "vitest";
import { toCsv } from "../csv";

describe("toCsv", () => {
  it("génère un en-tête et des lignes séparés par CRLF", () => {
    const csv = toCsv(
      [{ a: "x", b: 1 }],
      [
        { key: "a", header: "A" },
        { key: "b", header: "B" },
      ]
    );
    expect(csv).toBe("﻿A,B\r\nx,1\r\n");
  });

  it("échappe les valeurs contenant une virgule, un guillemet ou un retour à la ligne", () => {
    const csv = toCsv(
      [{ note: 'Dépôt "spécial", du client\nligne 2' }],
      [{ key: "note", header: "Note" }]
    );
    expect(csv).toContain('"Dépôt ""spécial"", du client\nligne 2"');
  });

  it("représente null/undefined par une cellule vide", () => {
    const csv = toCsv([{ v: null }, { v: undefined }], [{ key: "v", header: "V" }]);
    const lines = csv.replace("﻿", "").split("\r\n");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("");
  });
});
