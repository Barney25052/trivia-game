import assert from "assert";
import {
    OpenTdbError,
    OpenTdbResponseCodeError,
    OpenTdbFetcher,
    OpenTdbResponse,
    createOpenTdbQuestionSource,
    decodeHtmlEntities,
    fetchMcQuestions,
    mapOpenTdbPayload
} from "../src/questions/opentdb.js";

/** A realistic OpenTDB `type=multiple` payload with three usable questions and
 * several malformed ones that must be dropped by the mapper. */
const validPayload = {
    response_code: 0,
    results: [
        {
            type: "multiple",
            difficulty: "medium",
            category: "Entertainment: Japanese Anime &amp; Manga",
            question: "In the anime series &quot;Naruto&quot;, what is the name of the fox spirit sealed inside the main character?",
            correct_answer: "Kurama",
            incorrect_answers: ["Shukaku", "Son Goku", "Matatabi"]
        },
        {
            type: "multiple",
            difficulty: "easy",
            category: "Science &amp; Nature",
            question: "What is the chemical symbol for gold?",
            correct_answer: "Au",
            incorrect_answers: ["Ag", "Fe", "Gd"]
        },
        {
            type: "multiple",
            difficulty: "hard",
            category: "General Knowledge",
            question: "You say you&#039;ll take the &eacute;clair?",
            correct_answer: "&#233;clair",
            incorrect_answers: ["Klaxon", "Semaphore", "Basilisk"]
        },
        // --- malformed items, all should be dropped ---
        {
            type: "multiple",
            difficulty: "easy",
            category: "General Knowledge",
            question: "Only two incorrect answers here",
            correct_answer: "X",
            incorrect_answers: ["A", "B"]
        },
        {
            type: "multiple",
            difficulty: "easy",
            category: "General Knowledge",
            question: "Non-string correct answer",
            correct_answer: 42,
            incorrect_answers: ["A", "B", "C"]
        },
        {
            type: "multiple",
            difficulty: "easy",
            category: "General Knowledge",
            question: "Duplicate options make the index ambiguous",
            correct_answer: "Same",
            incorrect_answers: ["Same", "B", "C"]
        },
        null,
        "not an object"
    ]
};

const noCorrectPayload = {
    response_code: 0,
    results: [
        {
            type: "multiple",
            difficulty: "easy",
            category: "General Knowledge",
            question: "Every option differs from a missing correct_answer",
            incorrect_answers: ["A", "B", "C"]
        }
    ]
};

/** A fake OpenTDB response object. */
function jsonResponse(status: number, body: unknown): OpenTdbResponse {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    };
}

describe("opentdb", () => {
    describe("decodeHtmlEntities", () => {
        it("decodes named entities", () => {
            assert.strictEqual(decodeHtmlEntities("Tom &amp; Jerry"), "Tom & Jerry");
            assert.strictEqual(decodeHtmlEntities("&quot;quoted&quot;"), "\"quoted\"");
            assert.strictEqual(decodeHtmlEntities("a &lt; b &gt; c"), "a < b > c");
            assert.strictEqual(decodeHtmlEntities("Tom&#039;s"), "Tom's");
        });

        it("decodes accented letters from named entities", () => {
            assert.strictEqual(decodeHtmlEntities("&eacute;clair"), "éclair");
            assert.strictEqual(decodeHtmlEntities("&agrave; la mode"), "à la mode");
            assert.strictEqual(decodeHtmlEntities("&uuml;ber"), "über");
            assert.strictEqual(decodeHtmlEntities("&ntilde;o"), "ño");
        });

        it("decodes numeric character references, decimal and hex", () => {
            assert.strictEqual(decodeHtmlEntities("caf&#233;"), "café");
            assert.strictEqual(decodeHtmlEntities("It&#039;s"), "It's");
            assert.strictEqual(decodeHtmlEntities("&#x2603;"), "☃");
        });

        it("decodes punctuation and symbol entities", () => {
            assert.strictEqual(decodeHtmlEntities("A &mdash; B &ndash; C"), "A — B – C");
            assert.strictEqual(decodeHtmlEntities("stop &hellip;"), "stop …");
            assert.strictEqual(decodeHtmlEntities("&ldquo;hi&rdquo;"), "\u201chi\u201d");
        });

        it("leaves unknown named entities intact rather than guessing", () => {
            assert.strictEqual(decodeHtmlEntities("keep &bogus; text"), "keep &bogus; text");
        });
    });

    describe("mapOpenTdbPayload", () => {
        it("maps valid results into the server-held MC shape", () => {
            const questions = mapOpenTdbPayload(validPayload);
            assert.strictEqual(questions.length, 3);

            const expectedCorrect = ["Kurama", "Au", "éclair"];
            const expectedCategories = [
                "Entertainment: Japanese Anime & Manga",
                "Science & Nature",
                "General Knowledge"
            ];
            const ids = new Set<string>();
            for (let i = 0; i < questions.length; i += 1) {
                const question = questions[i];
                assert.strictEqual(typeof question.id, "string");
                assert.ok(question.id.length > 0, "each question must carry an id");
                assert.strictEqual(question.category, expectedCategories[i], "category should be HTML-decoded");
                ids.add(question.id);

                assert.ok(question.question.length > 0, "question text must be non-empty");
                assert.strictEqual(
                    question.options.length,
                    4,
                    `each MC question must hold exactly 4 options, got ${question.options.length}`
                );
                const distinct = new Set(question.options);
                assert.strictEqual(distinct.size, 4, "options must be distinct");
                assert.ok(
                    Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex <= 3,
                    `correctIndex must be an option index, got ${question.correctIndex}`
                );
                assert.strictEqual(
                    question.options[question.correctIndex],
                    expectedCorrect[i],
                    "the option at correctIndex should be the decoded correct answer"
                );
            }
            assert.strictEqual(ids.size, questions.length, "ids must be unique");
        });

        it("trims and decodes option text", () => {
            const payload = {
                response_code: 0,
                results: [{
                    type: "multiple",
                    difficulty: "easy",
                    category: "General Knowledge",
                    question: "  What is  a   test?  ",
                    correct_answer: "  A &amp; B  ",
                    incorrect_answers: [" C ", " D ", " E "]
                }]
            };
            const [question] = mapOpenTdbPayload(payload);
            assert.strictEqual(question.question, "What is a test?");
            assert.strictEqual(question.options[question.correctIndex], "A & B");
        });

        it("drops malformed items and keeps the valid ones", () => {
            const questions = mapOpenTdbPayload(validPayload);
            assert.strictEqual(questions.length, 3);
            for (const question of questions) {
                assert.ok(!["Only two incorrect", "Non-string", "Duplicate options"].includes(question.question));
            }
        });

        it("throws OpenTdbError when the payload has no results array", () => {
            assert.throws(() => mapOpenTdbPayload({ response_code: 0 }), OpenTdbError);
            assert.throws(() => mapOpenTdbPayload("nope"), OpenTdbError);
            assert.throws(() => mapOpenTdbPayload(null), OpenTdbError);
        });

        it("throws OpenTdbError when no usable question survives mapping", () => {
            assert.throws(() => mapOpenTdbPayload(noCorrectPayload), OpenTdbError);
        });

        it("throws OpenTdbResponseCodeError carrying the code for non-zero response_code", () => {
            for (const code of [1, 2, 3, 4]) {
                assert.throws(
                    () => mapOpenTdbPayload({ response_code: code, results: [] }),
                    (error: Error) => error instanceof OpenTdbResponseCodeError && error.code === code
                );
            }
        });
    });

    describe("fetchMcQuestions", () => {
        it("fetches and maps a valid payload (no network — injected fetcher)", async () => {
            const calls: string[] = [];
            const fetcher: OpenTdbFetcher = (url, init) => {
                calls.push(url);
                assert.ok(init.signal instanceof AbortSignal, "fetch must carry an abort signal");
                return Promise.resolve(jsonResponse(200, validPayload));
            };
            const questions = await fetchMcQuestions({ fetcher, amount: 10 });
            assert.strictEqual(questions.length, 3);
            assert.strictEqual(calls.length, 1);

            const url = new URL(calls[0]);
            assert.strictEqual(url.origin + url.pathname, "https://opentdb.com/api.php");
            assert.strictEqual(url.searchParams.get("amount"), "10");
            assert.strictEqual(url.searchParams.get("type"), "multiple");
        });

        it("honours difficulty, category, and token query filters", async () => {
            let calledUrl = "";
            const fetcher: OpenTdbFetcher = (url) => {
                calledUrl = url;
                return Promise.resolve(jsonResponse(200, validPayload));
            };
            await fetchMcQuestions({ fetcher, amount: 7, difficulty: "hard", category: 15, token: "tok-42" });
            const url = new URL(calledUrl);
            assert.strictEqual(url.searchParams.get("amount"), "7");
            assert.strictEqual(url.searchParams.get("difficulty"), "hard");
            assert.strictEqual(url.searchParams.get("category"), "15");
            assert.strictEqual(url.searchParams.get("token"), "tok-42");
        });

        it("rejects an invalid difficulty or category before any network call", async () => {
            let calls = 0;
            const fetcher: OpenTdbFetcher = () => {
                calls += 1;
                return Promise.resolve(jsonResponse(200, validPayload));
            };
            await assert.rejects(() => fetchMcQuestions({ fetcher, difficulty: "impossible" }), OpenTdbError);
            await assert.rejects(() => fetchMcQuestions({ fetcher, category: 2 }), OpenTdbError);
            assert.strictEqual(calls, 0);
        });

        it("retries transient network failures within the retry budget", async () => {
            let attempts = 0;
            const fetcher: OpenTdbFetcher = () => {
                attempts += 1;
                if (attempts < 3) {
                    return Promise.reject(new Error("ECONNRESET"));
                }
                return Promise.resolve(jsonResponse(200, validPayload));
            };
            const questions = await fetchMcQuestions({ fetcher, retries: 3 });
            assert.strictEqual(questions.length, 3);
            assert.strictEqual(attempts, 3, "first two failed attempts should be retried");
        });

        it("retries HTTP 5xx but not HTTP 4xx", async () => {
            let fiveHundreds = 0;
            const flaky5xx: OpenTdbFetcher = () => {
                fiveHundreds += 1;
                if (fiveHundreds === 1) {
                    return Promise.resolve(jsonResponse(503, "nope"));
                }
                return Promise.resolve(jsonResponse(200, validPayload));
            };
            const ok = await fetchMcQuestions({ fetcher: flaky5xx, retries: 1 });
            assert.strictEqual(ok.length, 3);
            assert.strictEqual(fiveHundreds, 2);

            let calls = 0;
            const hard404: OpenTdbFetcher = () => {
                calls += 1;
                return Promise.resolve(jsonResponse(404, "nope"));
            };
            await assert.rejects(() => fetchMcQuestions({ fetcher: hard404, retries: 3 }), OpenTdbError);
            assert.strictEqual(calls, 1, "permanent HTTP errors must not be retried");
        });

        it("gives up after the retry budget and throws a typed error", async () => {
            let attempts = 0;
            const alwaysDown: OpenTdbFetcher = () => {
                attempts += 1;
                return Promise.reject(new Error("timeout"));
            };
            await assert.rejects(
                () => fetchMcQuestions({ fetcher: alwaysDown, retries: 2 }),
                (error: Error) => error instanceof OpenTdbError && /3 attempts/.test(error.message)
            );
            assert.strictEqual(attempts, 3);
        });
    });

    describe("createOpenTdbQuestionSource", () => {
        const tokenPayload = { response_code: 0, token: "tok-A", results: [] as unknown[] };

        /** A fetcher serving the token endpoint and a fixed question payload. */
        function fakeOpenTdb(questionPayload: unknown) {
            return (url: string): Promise<OpenTdbResponse> => {
                if (url.includes("api_token.php")) {
                    return Promise.resolve(jsonResponse(200, tokenPayload));
                }
                return Promise.resolve(jsonResponse(200, questionPayload));
            };
        }

        /** Build a payload with `count` distinct usable questions. */
        function makePayload(count: number): { response_code: number; results: unknown[] } {
            const results: unknown[] = [];
            for (let i = 0; i < count; i += 1) {
                results.push({
                    type: "multiple",
                    difficulty: "easy",
                    category: "General Knowledge",
                    question: `Question number ${i}`,
                    correct_answer: `Answer ${i}`,
                    incorrect_answers: [`Wrong ${i}a`, `Wrong ${i}b`, `Wrong ${i}c`]
                });
            }
            return { response_code: 0, results };
        }

        it("requests a session token once, then draws non-repeating questions", async () => {
            const calls: string[] = [];
            const fetcher: OpenTdbFetcher = (url) => {
                calls.push(url);
                if (url.includes("api_token.php")) {
                    return Promise.resolve(jsonResponse(200, tokenPayload));
                }
                return Promise.resolve(jsonResponse(200, makePayload(10)));
            };

            const source = createOpenTdbQuestionSource({ fetcher, poolSize: 10 });
            const first = await source.getQuestions(3);
            const second = await source.getQuestions(3);

            assert.strictEqual(first.length, 3);
            assert.strictEqual(second.length, 3);
            const ids = new Set<string>([...first, ...second].map((question) => question.id));
            assert.strictEqual(ids.size, 6, "questions must not repeat across getQuestions calls");

            const tokenCalls = calls.filter((url) => url.includes("api_token.php"));
            assert.strictEqual(tokenCalls.length, 1, "the token should be fetched once");

            const questionCalls = calls.filter((url) => url.includes("api.php"));
            assert.ok(questionCalls.length >= 1, "the question API should be hit");
            for (const url of questionCalls) {
                assert.ok(url.includes("token=tok-A"), "question requests should carry the session token");
            }
        });

        it("returns fewer than requested when the API only has that many new questions", async () => {
            const limitedPayload = {
                response_code: 0,
                results: validPayload.results.slice(0, 2)
            };
            const source = createOpenTdbQuestionSource({ fetcher: fakeOpenTdb(limitedPayload), poolSize: 10 });
            const drawn = await source.getQuestions(5);
            assert.strictEqual(drawn.length, 2);

            const bonus = await source.getQuestions(5);
            assert.strictEqual(bonus.length, 0, "no new questions left to draw");
        });

        it("resets the session token and recovers from token exhaustion (response_code 4)", async () => {
            let questionCalls = 0;
            let tokenCommands: string[] = [];
            const fetcher: OpenTdbFetcher = (url) => {
                if (url.includes("api_token.php")) {
                    const command = new URL(url).searchParams.get("command") ?? "";
                    tokenCommands.push(command);
                    if (command === "reset") {
                        return Promise.resolve(jsonResponse(200, { response_code: 0, token: "tok-B", results: [] }));
                    }
                    return Promise.resolve(jsonResponse(200, { response_code: 0, token: "tok-A", results: [] }));
                }
                questionCalls += 1;
                if (questionCalls === 1) {
                    return Promise.resolve(jsonResponse(200, { response_code: 4, results: [] }));
                }
                return Promise.resolve(jsonResponse(200, validPayload));
            };

            const source = createOpenTdbQuestionSource({ fetcher, poolSize: 10 });
            const drawn = await source.getQuestions(3);

            assert.strictEqual(drawn.length, 3);
            assert.strictEqual(tokenCommands[0], "request");
            assert.ok(tokenCommands.includes("reset"), "exhausted tokens should be reset");
            assert.ok(
                tokenCommands.length >= 2,
                "request + reset should both happen before questions arrive"
            );
        });

        it("propagates a typed error when OpenTDB is unreachable", async () => {
            const fetcher: OpenTdbFetcher = () => Promise.reject(new Error("ECONNREFUSED"));
            const source = createOpenTdbQuestionSource({ fetcher, retries: 0 });
            await assert.rejects(() => source.getQuestions(3), OpenTdbError);
        });

        it("returns an empty array for a non-positive request", async () => {
            let calls = 0;
            const fetcher: OpenTdbFetcher = (url) => {
                calls += 1;
                if (url.includes("api_token.php")) {
                    return Promise.resolve(jsonResponse(200, tokenPayload));
                }
                return Promise.resolve(jsonResponse(200, validPayload));
            };
            const source = createOpenTdbQuestionSource({ fetcher });
            const drawn = await source.getQuestions(0);
            assert.deepStrictEqual(drawn, []);
            assert.strictEqual(calls, 0, "nothing should be fetched for a zero request");
        });
    });
});