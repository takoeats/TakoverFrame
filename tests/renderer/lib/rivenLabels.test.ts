import { describe, expect, it } from "vitest";

import { contractTitleLabel } from "../../../src/lib/marketContract";
import { rivenNameLabel, rivenWeaponLabel } from "../../../src/lib/rivenLabels";

describe("rivenNameLabel", () => {
  const names = {
    "critical chance": "치명타 확률",
    "fire rate / attack speed": "연사력 / 공격 속도",
  };

  it("looks the English label up case-blind and keeps it on a miss", () => {
    expect(rivenNameLabel("Critical Chance", names)).toBe("치명타 확률");
    expect(rivenNameLabel("Fire Rate / Attack Speed", names)).toBe("연사력 / 공격 속도");
    expect(rivenNameLabel("Zoom", names)).toBe("Zoom");
    expect(rivenNameLabel(null, names)).toBe("");
  });
});

describe("rivenWeaponLabel", () => {
  const db = {
    "/Lotus/Soma": { name: "Soma", displayName: "소마" },
    "/Lotus/Braton": { name: "Braton" },
  };

  it("shows the game-language weapon name, falling back to the riven's English one", () => {
    expect(rivenWeaponLabel({ weaponName: "Soma", weaponUniqueName: "/Lotus/Soma" }, db)).toBe(
      "소마",
    );
    expect(rivenWeaponLabel({ weaponName: "Braton", weaponUniqueName: "/Lotus/Braton" }, db)).toBe(
      "Braton",
    );
    expect(rivenWeaponLabel({ weaponName: "Kuva Bramma", weaponUniqueName: "" }, db)).toBe(
      "Kuva Bramma",
    );
  });
});

describe("contractTitleLabel", () => {
  const labels = { soma: "소마", "silva & aegis": "실바 앤 에이지스" };

  it("swaps the weapon the slug names and keeps the rest", () => {
    expect(contractTitleLabel({ itemName: "Soma Riven", weaponUrlName: "soma" }, labels)).toBe(
      "소마 Riven",
    );
    expect(
      contractTitleLabel(
        { itemName: "Silva And Aegis Riven", weaponUrlName: "silva_and_aegis" },
        labels,
      ),
    ).toBe("실바 앤 에이지스 Riven");
  });

  it("stays English when the title does not lead with the weapon", () => {
    expect(contractTitleLabel({ itemName: "Riven Contract", weaponUrlName: "soma" }, labels)).toBe(
      "Riven Contract",
    );
    expect(contractTitleLabel({ itemName: "Braton Riven", weaponUrlName: "braton" }, labels)).toBe(
      "Braton Riven",
    );
  });
});
