import assert from "assert";
import { checkAnswer } from "../src/questions/answerChecker.js";
import { ANSWER_CHECK } from "../src/gameConfig.js";

describe("answer checker", () => {
  it("exact match", () => {
    assert.strictEqual(checkAnswer("Mars", "Mars"), true);
  });

  it("case-insensitive", () => {
    assert.strictEqual(checkAnswer("mars", "Mars"), true);
  });

  it("leading/trailing whitespace", () => {
    assert.strictEqual(checkAnswer(" Mars ", "Mars"), true);
  });

  it("internal whitespace collapse", () => {
    assert.strictEqual(checkAnswer("Carbon  dioxide", "Carbon dioxide"), true);
  });

  it("spaces are irrelevant", () => {
    assert.strictEqual(checkAnswer("Twenty  Two", "TwentyTwo"), true);
  });

  it("filler words are removed", () => {
    assert.strictEqual(checkAnswer("Kermit The Frog", "KermitFrog"), true);
  });

  it("numeric answers", () => {
    assert.strictEqual(checkAnswer("206", "206"), true);
    assert.strictEqual(checkAnswer(" 206 ", "206"), true);
  });

  it("partial match with transposition passes", () => {
    assert.strictEqual(checkAnswer("Masr", "Mars"), true);
  });

  it("single-letter substitution passes", () => {
    assert.strictEqual(checkAnswer("Xars", "Mars"), true);
  });

  it("single-letter insertion passes", () => {
    assert.strictEqual(checkAnswer("Marss", "Mars"), true);
  });

  it("single-letter deletion passes", () => {
    assert.strictEqual(checkAnswer("Mas", "Mars"), true);
  });

  it("wrong answer returns false", () => {
    assert.strictEqual(checkAnswer("Earth", "Mars"), false);
  });

  it("empty string returns false", () => {
    assert.strictEqual(checkAnswer("", "Mars"), false);
    assert.strictEqual(checkAnswer("   ", "Mars"), false);
  });

  it("a too-distant typo on a short answer fails", () => {
    assert.strictEqual(checkAnswer("Xarm", "Mars"), false);
  });

  it("handles common name typo: Marc Rufallo vs Mark Ruffalo", () => {
    assert.strictEqual(checkAnswer("Marc Rufallo", "Mark Ruffalo"), true);
  });

  it("handles sentence typos: Tihs is a porly writen snetnece", () => {
    assert.strictEqual(
      checkAnswer("Tihs is a porly writen snetnece", "this is a poorly written sentence"),
      true
    );
  });

  it("accepts an alternative answer alongside the canonical one", () => {
    assert.strictEqual(checkAnswer("Fyodor Dostoevsky", ["Dostoevsky", "Fyodor Dostoevsky"]), true);
  });

  it("accepts the canonical answer when alternatives are present", () => {
    assert.strictEqual(checkAnswer("Dostoevsky", ["Dostoevsky", "Fyodor Dostoevsky"]), true);
  });

  it("rejects an answer that matches no alternative", () => {
    assert.strictEqual(checkAnswer("Tolstoy", ["Dostoevsky", "Fyodor Dostoevsky"]), false);
  });

  it("an empty alternatives list still accepts the canonical answer", () => {
    assert.strictEqual(checkAnswer("Mars", ["Mars"]), true);
    assert.strictEqual(checkAnswer("Earth", ["Mars"]), false);
  });

  it("alternative matching is still lenient on case and whitespace", () => {
    assert.strictEqual(checkAnswer(" fyodor dostoevsky ", ["Dostoevsky", "Fyodor Dostoevsky"]), true);
  });

  it("a misspelled alternative passes if it is close enough", () => {
    assert.strictEqual(checkAnswer("Dostoevsyk", ["Dostoevsky", "Fyodor Dostoevsky"]), true);
  });
});

// Ticket 161 (bug-024): a wrong number is never a typo, and a whole
// different word isn't either, while genuine misspellings still pass.
describe("answer checker: numbers (ticket 161)", () => {
  it("rejects any other single digit for a single-digit answer", () => {
    for (const typed of ["6", "9", "3", "4", "0"]) {
      assert.strictEqual(checkAnswer(typed, ["Five", "5"]), false, typed);
    }
  });

  it("treats digits and number words as the same answer", () => {
    assert.strictEqual(checkAnswer("5", ["Five", "5"]), true);
    assert.strictEqual(checkAnswer("five", "5"), true);
    assert.strictEqual(checkAnswer("5", "Five"), true);
    assert.strictEqual(checkAnswer("zero", "0"), true);
  });

  it("rejects near-miss two-digit answers", () => {
    for (const typed of ["20", "23", "25", "42"]) {
      assert.strictEqual(checkAnswer(typed, "24"), false, typed);
    }
    for (const typed of ["44", "45", "6", "4"]) {
      assert.strictEqual(checkAnswer(typed, "46"), false, typed);
    }
    assert.strictEqual(checkAnswer("twenty four", "24"), true);
    assert.strictEqual(checkAnswer("24", "Twenty-Four"), true);
  });

  it("rejects a year one off", () => {
    assert.strictEqual(checkAnswer("1988", "1989"), false);
    assert.strictEqual(checkAnswer("1990", "1989"), false);
    assert.strictEqual(checkAnswer("1989", "1989"), true);
  });

  it("live bank row 815: only six Infinity Stones", () => {
    const accepted = ["Six", "6", "Six Stones"];
    for (const typed of ["5", "7", "9", "Seven", "Five Stones"]) {
      assert.strictEqual(checkAnswer(typed, accepted), false, typed);
    }
    for (const typed of ["6", "six", "Six Stones", "6 stones", "sixstones"]) {
      assert.strictEqual(checkAnswer(typed, accepted), true, typed);
    }
  });

  it("reads compound and ordinal number words", () => {
    assert.strictEqual(checkAnswer("One hundred and forty-seven", "147"), true);
    assert.strictEqual(checkAnswer("one hundred forty seven", "147"), true);
    assert.strictEqual(checkAnswer("148", "One hundred forty-seven"), false);
    assert.strictEqual(checkAnswer("100 Years of Solitude", "One Hundred Years of Solitude"), true);
    assert.strictEqual(checkAnswer("nineteenth", ["19th", "19"]), true);
    assert.strictEqual(checkAnswer("18th", ["19th", "19", "nineteenth"]), false);
    assert.strictEqual(checkAnswer("7 million", "7,000,000"), true);
  });

  it("keeps leading zeros significant", () => {
    assert.strictEqual(checkAnswer("007", "007"), true);
    assert.strictEqual(checkAnswer("7", "007"), false);
  });

  it("reads Roman numerals as numbers", () => {
    assert.strictEqual(checkAnswer("Louis XV", "Louis XIV"), false);
    assert.strictEqual(checkAnswer("Louis 14", "Louis XIV"), true);
    assert.strictEqual(checkAnswer("Louis the Fourteenth", "Louis XIV"), true);
    assert.strictEqual(checkAnswer("Elizabeth II", "Elizabeth I"), false);
    assert.strictEqual(checkAnswer("Frozen II", "Frozen 2"), true);
    const henry7 = ["Henry VII", "Henry 7", "King Henry VII"];
    assert.strictEqual(checkAnswer("Henry VIII", henry7), false);
    assert.strictEqual(checkAnswer("Henry 8th", henry7), false);
    assert.strictEqual(checkAnswer("Henry the Seventh", henry7), true);
  });

  it("doesn't let a numeral hide inside a word typed without spaces", () => {
    assert.strictEqual(checkAnswer("ElizabethII", "Elizabeth I"), false);
    assert.strictEqual(checkAnswer("HenryVIII", "Henry VII"), false);
    assert.strictEqual(checkAnswer("ElizabethI", "Elizabeth I"), true);
  });

  it("rejects numbered sequels for the original and vice versa", () => {
    assert.strictEqual(checkAnswer("Shrek 2", "Shrek"), false);
    assert.strictEqual(checkAnswer("Shrek", "Shrek 2"), false);
    assert.strictEqual(checkAnswer("Die Hard 2", "Die Hard"), false);
    assert.strictEqual(checkAnswer("Frozen 2", "Frozen"), false);
    assert.strictEqual(checkAnswer("Home Alone 2", ["Home Alone", "Home Alone 1"]), false);
  });

  it("matches digits inside words exactly", () => {
    assert.strictEqual(checkAnswer("CO 2", "CO2"), true);
    assert.strictEqual(checkAnswer("CO3", "CO2"), false);
    assert.strictEqual(checkAnswer("CR9", "CR7"), false);
    assert.strictEqual(checkAnswer("Farenheit 451", "Fahrenheit 451"), true);
    assert.strictEqual(checkAnswer("Fahrenheit 452", "Fahrenheit 451"), false);
  });
});

describe("answer checker: different answers sharing letters (ticket 161)", () => {
  it("rejects a swapped whole word", () => {
    assert.strictEqual(checkAnswer("Manchester City", "Manchester United"), false);
    assert.strictEqual(checkAnswer("Manchester United", "Manchester City"), false);
    assert.strictEqual(checkAnswer("Manchester City", "Leicester City"), false);
    assert.strictEqual(checkAnswer("ManchesterCity", "Manchester United"), false);
  });

  it("rejects a changed short word", () => {
    assert.strictEqual(checkAnswer("Serie B", "Serie A"), false);
    assert.strictEqual(checkAnswer("Serie A", "Serie B"), false);
    assert.strictEqual(checkAnswer("Serie C", "Serie B"), false);
    assert.strictEqual(checkAnswer("Vitamin C", "Vitamin D"), false);
    assert.strictEqual(checkAnswer("Malcolm", "Malcolm X"), false);
    assert.strictEqual(checkAnswer("Cat", "Bat"), false);
  });

  it("rejects a word whose length changes past its budget", () => {
    assert.strictEqual(checkAnswer("Baseball", "Basketball"), false);
    assert.strictEqual(checkAnswer("Basketball", "Baseball"), false);
    assert.strictEqual(checkAnswer("Base ball", "Basketball"), false);
    assert.strictEqual(checkAnswer("Austria", "Australia"), false);
    assert.strictEqual(checkAnswer("Burnley", "Barnsley"), false);
  });

  it("the bug-024 repro no longer passes", () => {
    assert.strictEqual(checkAnswer("6", ["Five", "5"]), false);
    assert.strictEqual(checkAnswer("Manchester City", ["Manchester United"]), false);
  });
});

describe("answer checker: typos that must still pass (ticket 161)", () => {
  it("accepts the typos from bug-024", () => {
    assert.strictEqual(checkAnswer("Thanus", "Thanos"), true);
    assert.strictEqual(checkAnswer("Scarlet Johanson", "Scarlett Johansson"), true);
    assert.strictEqual(checkAnswer("Wembly", "Wembley"), true);
    assert.strictEqual(checkAnswer("Aperature", "Aperture"), true);
  });

  it("accepts other everyday misspellings", () => {
    assert.strictEqual(checkAnswer("Einstine", "Einstein"), true);
    assert.strictEqual(checkAnswer("Missisippi", "Mississippi"), true);
    assert.strictEqual(checkAnswer("Swarzenegger", "Schwarzenegger"), true);
    assert.strictEqual(checkAnswer("Saara", "Sahara"), true);
    assert.strictEqual(checkAnswer("Manchester Unitd", "Manchester United"), true);
  });

  it("forgives a typo in a short word only by a dropped or swapped letter", () => {
    assert.strictEqual(checkAnswer("Bo Marley", "Bob Marley"), true);
    assert.strictEqual(checkAnswer("Doctor Hwo", "Doctor Who"), true);
    assert.strictEqual(checkAnswer("Fleetwood Mc", "Fleetwood Mac"), true);
  });

  it("forgives typos in filler words", () => {
    assert.strictEqual(checkAnswer("Teh Beatles", "The Beatles"), true);
    assert.strictEqual(checkAnswer("Th Godfather", "The Godfather"), true);
    assert.strictEqual(checkAnswer("Game off Thrones", "Game of Thrones"), true);
    assert.strictEqual(checkAnswer("Beatles", "The Beatles"), true);
    assert.strictEqual(checkAnswer("The Beatles", "Beatles"), true);
  });

  it("forgives doubled letters in number words, not other misspellings", () => {
    assert.strictEqual(checkAnswer("Seeven Samurai", "Seven Samurai"), true);
    assert.strictEqual(checkAnswer("thre", "three"), true);
    assert.strictEqual(checkAnswer("Sven Samurai", "Seven Samurai"), false);
  });

  it("ignores spacing, punctuation and accents", () => {
    assert.strictEqual(checkAnswer("Spiderman", "Spider-Man"), true);
    assert.strictEqual(checkAnswer("Spider Man", "Spiderman"), true);
    assert.strictEqual(checkAnswer("ACDC", "AC/DC"), true);
    assert.strictEqual(checkAnswer("Re dSea", "Red Sea"), true);
    assert.strictEqual(checkAnswer("Jarvis", "J.A.R.V.I.S."), true);
    assert.strictEqual(checkAnswer("JD Salinger", "J.D. Salinger"), true);
    assert.strictEqual(checkAnswer("Schindlers List", "Schindler's List"), true);
    assert.strictEqual(checkAnswer("Beyonce", "Beyoncé"), true);
    assert.strictEqual(checkAnswer("Pride and Prejudice", "Pride & Prejudice"), true);
  });

  it("an answer that is only filler keeps its filler", () => {
    assert.strictEqual(checkAnswer("the", "The"), true);
    assert.strictEqual(checkAnswer("a", "The"), false);
  });

  it("rejects an answer longer than the cap without checking it", () => {
    const tooLong = "Mars " + "x".repeat(ANSWER_CHECK.maxTypedLength);
    assert.strictEqual(checkAnswer(tooLong, "Mars"), false);
  });
});
